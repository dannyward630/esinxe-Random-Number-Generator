#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <stdint.h>

static const uint64_t ESINXE_GAMMA = UINT64_C(0x9E3779B97F4A7C15);
static const uint64_t ESINXE_MAX_INT_VALUE = UINT64_C(1000000000000000000);

static uint64_t mix64(uint64_t value)
{
    value = (value ^ (value >> 30)) * UINT64_C(0xBF58476D1CE4E5B9);
    value = (value ^ (value >> 27)) * UINT64_C(0x94D049BB133111EB);
    return value ^ (value >> 31);
}

static uint64_t bounded(uint64_t value, uint64_t maxvalue)
{
    if (maxvalue == 0)
    {
        return 0;
    }

    uint64_t threshold = (uint64_t)(0 - maxvalue) % maxvalue;
    uint64_t nonce = 0;
    while (value < threshold)
    {
        nonce++;
        value = mix64(value + (nonce * ESINXE_GAMMA));
    }
    return value % maxvalue;
}

static int parse_u64(PyObject *obj, uint64_t *out)
{
    PyObject *masked = NULL;
    PyObject *mask = PyLong_FromUnsignedLongLong(UINT64_MAX);
    if (mask == NULL)
    {
        return 0;
    }

    masked = PyNumber_And(obj, mask);
    Py_DECREF(mask);
    if (masked == NULL)
    {
        return 0;
    }

    *out = PyLong_AsUnsignedLongLong(masked);
    Py_DECREF(masked);
    return !PyErr_Occurred();
}

static PyObject *py_mix64(PyObject *self, PyObject *arg)
{
    (void)self;
    uint64_t value;
    if (!parse_u64(arg, &value))
    {
        return NULL;
    }
    return PyLong_FromUnsignedLongLong(mix64(value));
}

static PyObject *py_raw_list(PyObject *self, PyObject *args)
{
    (void)self;
    PyObject *key_obj;
    Py_ssize_t length;
    uint64_t key;
    if (!PyArg_ParseTuple(args, "On", &key_obj, &length))
    {
        return NULL;
    }
    if (length < 0)
    {
        length = 0;
    }
    if (!parse_u64(key_obj, &key))
    {
        return NULL;
    }

    PyObject *values = PyList_New(length);
    if (values == NULL)
    {
        return NULL;
    }

    for (Py_ssize_t i = 0; i < length; i++)
    {
        PyObject *item = PyLong_FromUnsignedLongLong(mix64(key));
        if (item == NULL)
        {
            Py_DECREF(values);
            return NULL;
        }
        PyList_SET_ITEM(values, i, item);
        key += ESINXE_GAMMA;
    }
    return values;
}

static PyObject *py_bounded_list(PyObject *self, PyObject *args)
{
    (void)self;
    PyObject *key_obj;
    Py_ssize_t length;
    uint64_t key;
    uint64_t maxvalue;
    if (!PyArg_ParseTuple(args, "OnK", &key_obj, &length, &maxvalue))
    {
        return NULL;
    }
    if (length < 0)
    {
        length = 0;
    }
    if (!parse_u64(key_obj, &key))
    {
        return NULL;
    }

    PyObject *values = PyList_New(length);
    if (values == NULL)
    {
        return NULL;
    }

    for (Py_ssize_t i = 0; i < length; i++)
    {
        PyObject *item = PyLong_FromUnsignedLongLong(bounded(mix64(key), maxvalue));
        if (item == NULL)
        {
            Py_DECREF(values);
            return NULL;
        }
        PyList_SET_ITEM(values, i, item);
        key += ESINXE_GAMMA;
    }
    return values;
}

static PyObject *py_default_list(PyObject *self, PyObject *args)
{
    (void)self;
    PyObject *key_obj;
    Py_ssize_t length;
    uint64_t key;
    if (!PyArg_ParseTuple(args, "On", &key_obj, &length))
    {
        return NULL;
    }
    if (length < 0)
    {
        length = 0;
    }
    if (!parse_u64(key_obj, &key))
    {
        return NULL;
    }

    PyObject *values = PyList_New(length);
    if (values == NULL)
    {
        return NULL;
    }

    for (Py_ssize_t i = 0; i < length; i++)
    {
        PyObject *item =
            PyLong_FromUnsignedLongLong(bounded(mix64(key), ESINXE_MAX_INT_VALUE));
        if (item == NULL)
        {
            Py_DECREF(values);
            return NULL;
        }
        PyList_SET_ITEM(values, i, item);
        key += ESINXE_GAMMA;
    }
    return values;
}

static PyMethodDef methods[] = {
    {"mix64", py_mix64, METH_O, "Return the 64-bit mixed value."},
    {"raw_list", py_raw_list, METH_VARARGS, "Return raw 64-bit values."},
    {"default_list", py_default_list, METH_VARARGS, "Return default bounded values."},
    {"bounded_list", py_bounded_list, METH_VARARGS, "Return bounded values."},
    {NULL, NULL, 0, NULL},
};

static struct PyModuleDef module = {
    PyModuleDef_HEAD_INIT,
    "_native",
    "Native acceleration for esinxe.",
    -1,
    methods,
};

PyMODINIT_FUNC PyInit__native(void)
{
    return PyModule_Create(&module);
}

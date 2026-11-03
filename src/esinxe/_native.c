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
    PyObject *maxvalue_obj;
    if (!PyArg_ParseTuple(args, "OnO", &key_obj, &length, &maxvalue_obj))
    {
        return NULL;
    }
    /* Unlike the K format, this rejects negative and overflowing bounds. */
    maxvalue = PyLong_AsUnsignedLongLong(maxvalue_obj);
    if (PyErr_Occurred())
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

static uint64_t fnv_update(uint64_t hash, const unsigned char *data, Py_ssize_t length)
{
    for (Py_ssize_t i = 0; i < length; i++)
    {
        hash = (hash ^ data[i]) * UINT64_C(0x100000001B3);
    }
    return hash;
}

typedef struct KeyedRow
{
    const unsigned char *data;
    Py_ssize_t length;
    uint64_t value;
} KeyedRow;

static PyObject *py_keyed_list(PyObject *self, PyObject *args)
{
    (void)self;
    PyObject *seed_obj, *prefix_obj, *rows_obj;
    if (!PyArg_ParseTuple(args, "OOO", &seed_obj, &prefix_obj, &rows_obj))
        return NULL;
    if (PyBool_Check(seed_obj))
    {
        PyErr_SetString(PyExc_TypeError, "seed must be an integer, not bool");
        return NULL;
    }
    uint64_t seed = PyLong_AsUnsignedLongLong(seed_obj);
    if (PyErr_Occurred()) return NULL;
    if (!PyBytes_Check(prefix_obj))
    {
        PyErr_SetString(PyExc_TypeError, "encoded prefix must be immutable bytes");
        return NULL;
    }
    /* Own a tuple snapshot: a caller may mutate its input list while the GIL is
       released. The tuple keeps every immutable bytes buffer alive throughout. */
    PyObject *rows = PySequence_Tuple(rows_obj);
    if (rows == NULL) return NULL;
    Py_ssize_t length = PyTuple_GET_SIZE(rows);
    if ((size_t)length > SIZE_MAX / sizeof(KeyedRow))
    {
        Py_DECREF(rows);
        return PyErr_NoMemory();
    }
    KeyedRow *encoded = length ? PyMem_Malloc((size_t)length * sizeof(KeyedRow)) : NULL;
    if (length && encoded == NULL)
    {
        Py_DECREF(rows);
        return PyErr_NoMemory();
    }
    for (Py_ssize_t i = 0; i < length; i++)
    {
        PyObject *row = PyTuple_GET_ITEM(rows, i);
        if (!PyBytes_Check(row))
        {
            PyMem_Free(encoded);
            Py_DECREF(rows);
            PyErr_SetString(PyExc_TypeError, "encoded rows must be immutable bytes");
            return NULL;
        }
        encoded[i].data = (const unsigned char *)PyBytes_AS_STRING(row);
        encoded[i].length = PyBytes_GET_SIZE(row);
    }
    static const unsigned char version[] = "esinxe-v1";
    unsigned char seed_bytes[8];
    for (unsigned int i = 0; i < 8; i++) seed_bytes[i] = (unsigned char)(seed >> (8 * i));
    uint64_t base = fnv_update(UINT64_C(0xCBF29CE484222325), version, sizeof(version));
    base = fnv_update(base, seed_bytes, 8);
    base = fnv_update(base, (const unsigned char *)PyBytes_AS_STRING(prefix_obj),
                      PyBytes_GET_SIZE(prefix_obj));
    Py_BEGIN_ALLOW_THREADS
    for (Py_ssize_t i = 0; i < length; i++)
        encoded[i].value = mix64(fnv_update(base, encoded[i].data, encoded[i].length));
    Py_END_ALLOW_THREADS
    PyObject *values = PyList_New(length);
    if (values != NULL)
    {
        for (Py_ssize_t i = 0; i < length; i++)
        {
            PyObject *item = PyLong_FromUnsignedLongLong(encoded[i].value);
            if (item == NULL) { Py_CLEAR(values); break; }
            PyList_SET_ITEM(values, i, item);
        }
    }
    PyMem_Free(encoded);
    Py_DECREF(rows);
    return values;
}

static PyMethodDef methods[] = {
    {"mix64", py_mix64, METH_O, "Return the 64-bit mixed value."},
    {"raw_list", py_raw_list, METH_VARARGS, "Return raw 64-bit values."},
    {"default_list", py_default_list, METH_VARARGS, "Return default bounded values."},
    {"bounded_list", py_bounded_list, METH_VARARGS, "Return bounded values."},
    {"keyed_list", py_keyed_list, METH_VARARGS, "Hash immutable encoded keyed rows."},
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

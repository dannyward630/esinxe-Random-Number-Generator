from setuptools import Extension, setup


setup(
    package_dir={"": "src"},
    ext_modules=[
        Extension(
            "esinxe._native",
            ["src/esinxe/_native.c"],
            optional=True,
        )
    ],
)

from setuptools import setup


setup(
    name="esinxe",
    version="1.0.2",
    description="Deterministic random-access number generator for procedural generation",
    long_description=open("README.md", encoding="utf-8").read(),
    long_description_content_type="text/markdown",
    author="Danny Ward",
    license="MIT",
    packages=["esinxe"],
    python_requires=">=3.9",
    keywords=[
        "deterministic",
        "procedural-generation",
        "random",
        "random-access",
        "rng",
    ],
)

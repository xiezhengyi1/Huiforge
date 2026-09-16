"""Huiju backend package.

Import submodules explicitly; keeping package import side-effect free allows
database migrations and contract tests to run without starting FastAPI/GPU
services.
"""

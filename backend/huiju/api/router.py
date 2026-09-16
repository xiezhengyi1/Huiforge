"""Route registration for the public HTTP API."""
from fastapi import FastAPI

from .routes import agents, images, media, plaza, system, users, workflows


def include_api_routes(app: FastAPI) -> None:
    app.include_router(system.router)
    app.include_router(users.router)
    app.include_router(workflows.router)
    app.include_router(plaza.router)
    app.include_router(images.router)
    app.include_router(media.router)
    app.include_router(agents.router)

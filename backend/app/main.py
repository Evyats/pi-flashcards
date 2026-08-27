from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .database import initialize_database
from .errors import ConflictError, InvalidOrderError, NotFoundError
from .routers import cards, daily_tasks, groups, tabs


API_PREFIX = "/flashcards/api"


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Flashcards API", version="1.0.0", lifespan=lifespan)


def error_response(_: Request, error: Exception, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": str(error)})


@app.exception_handler(NotFoundError)
def not_found(request: Request, error: NotFoundError) -> JSONResponse:
    return error_response(request, error, 404)


@app.exception_handler(InvalidOrderError)
def invalid_order(request: Request, error: InvalidOrderError) -> JSONResponse:
    return error_response(request, error, 400)


@app.exception_handler(ConflictError)
def conflict(request: Request, error: ConflictError) -> JSONResponse:
    return error_response(request, error, 409)


@app.get(f"{API_PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(tabs.router, prefix=API_PREFIX)
app.include_router(groups.router, prefix=API_PREFIX)
app.include_router(cards.router, prefix=API_PREFIX)
app.include_router(daily_tasks.router, prefix=API_PREFIX)

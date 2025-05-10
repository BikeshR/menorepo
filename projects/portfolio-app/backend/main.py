import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .routers import tickers

import os


class BackgroundRunner:
    def __init__(self) -> None:
        self.value = 0

    async def run_main(self):
        self.value += 1
        # while True:
        #     await asyncio.sleep(5)
        #     self.value += 1


runner = BackgroundRunner()


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(runner.run_main())
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(tickers.router, prefix="/tickers", tags=["tickers"])


@app.get("/api/healthcheck")
async def root():
    return {"message": runner.value}


@app.get("/items/{item_id}")
async def read_item(item_id: int, skip: int = 0):
    return {"item_id": item_id}


parent_folder = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
web_dist = os.path.join(parent_folder, "frontend", "dist")
app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")

import time
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

connect_args = {}
engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL (Neon Serverless) configurations
    connect_args = {
        "connect_timeout": 15  # Gives Neon 15 seconds to wake up from cold start
    }
    engine_kwargs["pool_recycle"] = 300  # Recycle connections every 5 minutes

engine = None
connected_successfully = False

# If configured with Neon or remote PostgreSQL, retry up to 4 times with backoff
# to handle cold starts and transient ISP DNS packet drops
max_retries = 4 if not settings.DATABASE_URL.startswith("sqlite") else 1

for attempt in range(1, max_retries + 1):
    try:
        temp_engine = create_engine(
            settings.DATABASE_URL,
            connect_args=connect_args,
            **engine_kwargs
        )
        with temp_engine.connect() as conn:
            pass
        engine = temp_engine
        connected_successfully = True
        print(f"Database: Connected to primary database successfully (Attempt {attempt}).")
        break
    except Exception as e:
        err_str = str(e).lower()
        if "psycopg" in err_str or "no module" in err_str:
            print(f"Database Notice: PostgreSQL driver not installed ({e}). Falling back to local SQLite immediately.")
            break
        if attempt < max_retries:
            print(f"Database Notice: Primary connection attempt {attempt} failed ({e}). Retrying in 1.5s...")
            time.sleep(1.5)
        else:
            print(f"Database Warning: Could not connect to configured DATABASE_URL after {max_retries} attempts ({e}). Falling back to local SQLite.")

if not connected_successfully:
    engine = create_engine(
        "sqlite:///./aarogyamitra.db",
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

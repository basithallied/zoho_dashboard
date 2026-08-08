from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Use a local SQLite database for now, as PostgreSQL requires setting up a separate server.
# Once deployed to DigitalOcean, this will be swapped for the managed PostgreSQL URL.
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} # check_same_thread is needed for SQLite
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

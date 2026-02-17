from sqlalchemy import inspect
from app.core.database import engine

def check_tables():
    inspector = inspect(engine)
    print("Existing tables:")
    for table_name in inspector.get_table_names():
        print(f" - {table_name}")

if __name__ == "__main__":
    check_tables()

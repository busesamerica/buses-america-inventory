#!/usr/bin/env python3
"""
Buses America - Quoting module migration runner.

Applies migrations/001_quotes.sql. Idempotent: safe to run on every deploy.

Usage:
    DATABASE_URL=postgres://... python migrate_quotes.py
"""

import os
import sys
import asyncio
import asyncpg

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")


def migration_files():
    """Every migrations/NNN_*.sql, applied in filename order."""
    return [
        os.path.join(MIGRATIONS_DIR, name)
        for name in sorted(os.listdir(MIGRATIONS_DIR))
        if name.endswith(".sql")
    ]


async def run():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        return False

    print("=" * 55)
    print("Buses America - Quoting module migration")
    print("=" * 55)

    conn = await asyncpg.connect(database_url)
    try:
        has_clients = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'clients'"
        )
        if not has_clients:
            print("ERROR: the 'clients' table does not exist.")
            print("       Run the base schema first, then re-run this migration.")
            return False

        for path in migration_files():
            with open(path, "r") as f:
                sql = f.read()
            # Each file is applied as one script: they contain DO $$ ... $$
            # blocks that must not be split on semicolons.
            await conn.execute(sql)
            print(f"  applied {os.path.basename(path)}")

        quotes = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_name IN ('quotes','quote_line_items')"
        )
        print(f"OK: quoting tables present ({quotes}/2)")
        return quotes == 2
    finally:
        await conn.close()


if __name__ == "__main__":
    ok = asyncio.run(run())
    print("Migration complete." if ok else "Migration FAILED.")
    sys.exit(0 if ok else 1)

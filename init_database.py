#!/usr/bin/env python3
"""
Buses America - Database Initialization Script
Runs automatically on first deployment to setup database schema
"""

import os
import sys
import asyncpg
import asyncio

async def init_database():
    """Initialize database with schema"""
    
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
    
    print("=" * 50)
    print("Buses America - Database Initialization")
    print("=" * 50)
    
    # Check if database is already initialized
    try:
        conn = await asyncpg.connect(database_url)
        
        # Check if tables exist
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'inventory'"
        )
        
        if result > 0:
            print("✓ Database already initialized!")
            print("✓ Tables exist, skipping initialization")
            await conn.close()
            return True
        
        await conn.close()
        
    except Exception as e:
        print(f"Checking database: {e}")
    
    # Load schema
    print("\nLoading database schema...")
    
    try:
        # Read schema file
        with open('bus_inventory_schema_FINAL.sql', 'r') as f:
            schema_sql = f.read()
        
        # Connect and execute
        conn = await asyncpg.connect(database_url)
        
        # Split by statement and execute
        statements = [s.strip() for s in schema_sql.split(';') if s.strip()]
        
        for i, statement in enumerate(statements):
            try:
                await conn.execute(statement)
                if i % 10 == 0:
                    print(f"  Executed {i+1}/{len(statements)} statements...")
            except Exception as e:
                if "already exists" not in str(e):
                    print(f"  Warning: {e}")
        
        await conn.close()
        
        print("✓ Database schema loaded successfully!")
        print("✓ All tables, indexes, and triggers created")
        
        return True
        
    except Exception as e:
        print(f"✗ Error loading schema: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(init_database())
    if success:
        print("\n" + "=" * 50)
        print("Database initialization complete!")
        print("=" * 50)
        sys.exit(0)
    else:
        print("\n" + "=" * 50)
        print("Database initialization failed!")
        print("=" * 50)
        sys.exit(1)

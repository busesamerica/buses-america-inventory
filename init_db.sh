#!/bin/bash
# Buses America - Database Initialization Script for Render.com
# This script runs automatically when the database is created

echo "========================================="
echo "Buses America - Database Setup"
echo "========================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set"
    exit 1
fi

echo "Database URL detected: ${DATABASE_URL:0:30}..."

# Load the schema
echo "Loading database schema..."
psql $DATABASE_URL < bus_inventory_schema_FINAL.sql

if [ $? -eq 0 ]; then
    echo "✓ Schema loaded successfully"
else
    echo "✗ Error loading schema"
    exit 1
fi

# Optional: Load sample data
echo ""
echo "Do you want to load sample data? (5 buses, 4 suppliers)"
echo "This is helpful for testing the system."
echo ""
read -p "Load sample data? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Loading sample data..."
    python seed_sample_data.py
    
    if [ $? -eq 0 ]; then
        echo "✓ Sample data loaded successfully"
    else
        echo "✗ Error loading sample data"
    fi
else
    echo "Skipping sample data"
fi

echo ""
echo "========================================="
echo "Database setup complete!"
echo "========================================="
echo ""
echo "Your Buses America system is ready!"
echo "Access your API at: https://your-app.onrender.com"
echo ""
echo "Default login:"
echo "  Username: admin"
echo "  Password: (check Render dashboard for auto-generated password)"
echo ""
echo "IMPORTANT: Change your password immediately!"
echo "========================================="

-- LOCAL DEVELOPMENT / TEST SEED DATA — see tests/dev_fixtures.sql for context.
-- Gives tests/test_quotes.py a client, five unsold units and a session token.

INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
SELECT 'USD','MXN',17.50,CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM exchange_rates);

INSERT INTO clients (client_name, client_company, client_location, client_email,
                     client_phone, contact_person, tax_id, billing_address)
VALUES ('Transportes del Norte','Transportes del Norte S.A. de C.V.','Monterrey, NL',
        'ventas@tdn.mx','+52 81 1234 5678','Luis Ramírez','TDN980101ABC',
        'Av. Constitución 1200, Monterrey, NL');

INSERT INTO inventory (stock_number, vin, year, make, model, body_style, passenger_capacity,
                       odometer, purchase_date, purchase_price_usd, transport_to_stock_cost_usd,
                       asking_price, asking_currency, status, current_location)
VALUES
 ('BA-101','1HVBBABN1YH123456',2015,'Blue Bird','Vision','School Bus',72,145000,'2025-03-01',18000,1200,32500,'USD','In Stock (US)','US Stock'),
 ('BA-102','1HVBBABN1YH123457',2016,'IC Bus','CE Series','School Bus',77,132000,'2025-03-05',21000,1400,36900,'USD','In Stock (US)','US Stock'),
 ('BA-103','1HVBBABN1YH123458',2014,'Thomas','C2','School Bus',71,160000,'2025-04-10',16500,1100,29900,'USD','In Stock (US)','US Stock'),
 ('BA-104','1HVBBABN1YH123459',2017,'Blue Bird','Vision','School Bus',78,118000,'2025-05-02',23500,0,34500,'USD','In Stock (US)','US Stock'),
 ('BA-105','1HVBBABN1YH123460',2013,'IC Bus','RE Series','Transit Bus',44,175000,'2025-05-20',14000,0,24900,'USD','In Stock (US)','US Stock');

INSERT INTO cost_items (inventory_id, cost_category, description, amount, currency, date_incurred)
SELECT inventory_id,'Initial Reconditioning','Brakes and tires',2200,'USD','2025-04-01'
FROM inventory WHERE stock_number = 'BA-101';

INSERT INTO users (username, password_hash, full_name, email, role)
VALUES ('tester','x','Test Admin','t@example.com','admin');

INSERT INTO user_sessions (user_id, session_token, expires_at)
SELECT user_id, 'TEST-TOKEN-123', CURRENT_TIMESTAMP + INTERVAL '1 day'
FROM users WHERE username = 'tester';

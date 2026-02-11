-- Rename risk profile presets to fund names -- v13

UPDATE risk_profiles
SET name = 'Neutralis Stability Fund',
    description = 'Capital preservation with consistent, low-risk edges. Tight filters, smaller positions, and conservative exposure limits.'
WHERE preset = 'conservative' AND user_id IS NULL;

UPDATE risk_profiles
SET name = 'Neutralis Core Fund',
    description = 'Balanced risk and reward across all market categories. The default fund for steady, diversified returns.'
WHERE preset = 'moderate' AND user_id IS NULL;

UPDATE risk_profiles
SET name = 'Neutralis Opportunity Fund',
    description = 'Wider signal acceptance and larger positions. Seeks higher returns by capturing more opportunities at elevated risk.'
WHERE preset = 'aggressive' AND user_id IS NULL;

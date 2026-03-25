UPDATE affiliate_tiers SET commission_pct = 1.5 WHERE tier_name = 'Starter';
UPDATE affiliate_tiers SET commission_pct = 2 WHERE tier_name = 'Bronze';
UPDATE affiliate_tiers SET commission_pct = 2.5 WHERE tier_name = 'Silver';
UPDATE affiliate_tiers SET commission_pct = 3 WHERE tier_name = 'Gold';
UPDATE affiliate_tiers SET commission_pct = 3.5 WHERE tier_name = 'Platinum';
UPDATE platform_settings SET value = value || '{"affiliate_bonus_enabled": false}'::jsonb WHERE key = 'referral_settings';
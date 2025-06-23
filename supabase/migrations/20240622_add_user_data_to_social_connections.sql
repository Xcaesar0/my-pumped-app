DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'social_connections' AND column_name = 'user_data'
  ) THEN
    ALTER TABLE social_connections ADD COLUMN user_data jsonb;
  END IF;
END $$; 
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, 
  email_confirmed_at, recovery_sent_at, last_sign_in_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, 
  updated_at, confirmation_token, email_change, 
  email_change_token_new, recovery_token
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 
  'authenticated', 'authenticated', 'till@lgams.com.br', 
  extensions.crypt('292919', extensions.gen_salt('bf')), 
  now(), now(), now(), 
  '{"provider":"email","providers":["email"]}', '{}', 
  now(), now(), '', '', '', ''
);
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT,
  video TEXT,
  buttonText TEXT DEFAULT 'En savoir plus',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO news (title, category, description, image, video, buttonText)
VALUES
(
  'Camp de jeunes pour l''été 2026',
  'Église',
  'Une semaine de louange, enseignement et moments de réflexion pour les adolescents.',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
  '',
  'Participer'
),
(
  'Action solidaire dans le quartier',
  'Mission',
  'Nous distribuons aide alimentaire et soutien aux familles en difficulté.',
  'https://images.unsplash.com/photo-1517486800579-88f2c0fa0f72?auto=format&fit=crop&w=900&q=80',
  '',
  'Soutenir'
)
ON CONFLICT DO NOTHING;

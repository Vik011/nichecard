-- Sonar: enable pgvector for embedding-based niche clustering.
create extension if not exists vector with schema extensions;

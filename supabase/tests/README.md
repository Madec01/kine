# Vérification du schéma hors Supabase

Ces scripts rejouent la migration sur un PostgreSQL local (16 ou plus) en
simulant les schémas `auth` et `storage` de Supabase, puis vérifient les
politiques RLS : isolation entre utilisateurs, lecteur bloqué en écriture,
collaborateur autorisé, invitations, cohérence des tags entre bibliothèques.

```sh
createdb kine_check
psql -v ON_ERROR_STOP=1 -d kine_check -f supabase/tests/00_stubs.sql
psql -v ON_ERROR_STOP=1 -d kine_check -f supabase/migrations/0001_schema.sql
psql -v ON_ERROR_STOP=1 -d kine_check -f supabase/migrations/0001_schema.sql   # idempotence
psql -v ON_ERROR_STOP=1 -d kine_check -f supabase/tests/10_rls_smoke.sql
```

Chaque vérification affiche `OK: …` ; une anomalie interrompt le script.
Les stubs ne remplacent pas Supabase : ils servent uniquement à valider la
syntaxe et la logique des politiques avant de les appliquer au vrai projet.

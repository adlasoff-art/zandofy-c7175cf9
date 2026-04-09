

## Problème

Le bucket `seo-assets` existe bien en base, mais il manque une politique **UPDATE** sur `storage.objects`. Quand le code utilise `upload(path, file, { upsert: true })`, Supabase exige une politique UPDATE en plus de INSERT. Sans elle, l'upload échoue avec "Bucket not found" (message d'erreur trompeur de Supabase).

## Solution

**1 migration SQL** — Ajouter la politique UPDATE manquante :

```sql
CREATE POLICY "Admins update seo assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'seo-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'seo-assets' AND public.has_role(auth.uid(), 'admin'));
```

Aucun changement de code côté frontend nécessaire. Le composant `SeoBrandingSection.tsx` fonctionnera tel quel après cette correction.


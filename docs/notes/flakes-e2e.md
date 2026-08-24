# Flakes e2e connues (doctrine : UN retry, jamais de quarantaine silencieuse)

Un échec e2e qui disparaît au retry N'EST PAS ignoré : il est consigné ici avec sa
signature, sa cause présumée et la conduite à tenir. Un runner qui masque un échec
est un incident (CLAUDE.md).

1. **« Cannot log after tests are done » (fat-swarm / tick outbox)** — le tick outbox
   émet après le teardown de la suite. Signature : suite VERTE test à test, EXIT 1 au
   total. Conduite : un retry ; si le retry est vert, poursuivre. Correctif de fond
   (arrêt propre du tick au teardown) : dette connue.
2. **Rafale de FAIL massifs « Can't reach database server at localhost:5433 »** — le
   cluster Postgres local (pg_ctlcluster 16 olivetest) retombe, notamment après un
   redémarrage de conteneur. Conduite : `pg_ctlcluster 16 olivetest start` puis rerun.
   Ne JAMAIS conclure au code sur cette signature.
3. **Échec isolé d'une suite moteur (ex. cross-border-moteur) dans les 1-2 runs qui
   SUIVENT un redémarrage du cluster** (constaté 2026-08-08 : 2 occurrences, puis 4
   passes complètes vertes consécutives ; la suite est verte isolée). Cause présumée :
   churn de connexions Prisma juste après le restart. Conduite : un retry après
   stabilisation ; si l'échec persiste hors contexte post-restart, OUVRIR une
   investigation — ce n'est alors plus cette flake.
4. **2 échecs non nommés après un redémarrage du cluster (V2-M48, 12.08.2026)** — même
   contexte que le n°3 : le cluster venait d'être relancé (voir n°5). Signature :
   `2 failed, 519 passed` sur le run qui suit immédiatement le restart, puis **deux
   passes complètes 521/521** consécutives. Les noms des suites n'ont pas pu être
   relevés — le run était lancé avec `--silent`, qui masque les noms. **Conduite pour
   la prochaine fois : ne pas diagnostiquer un échec e2e sous `--silent`.** Un run
   dont on ne peut pas nommer l'échec ne prouve rien, ni dans un sens ni dans l'autre.
5. **Le cluster Postgres qui « répond » n'est pas forcément LE bon cluster (V2-M48)** —
   quatre répertoires de données coexistent sur cette machine
   (`/var/lib/postgresql/{olive-pg, olive_pgdata, 16/main, 16/olivetest}`). Après une
   suspension de conteneur, tous les `postmaster.pid` sont périmés. Démarrer
   `16/main` sur le port 5433 donne un `pg_isready` VERT et un `psql` qui échoue en
   « password authentication failed for user olive » : le rôle n'existe pas dans ce
   cluster-là. La bonne base de démonstration est **`/var/lib/postgresql/olive-pg`** :
   `rm -f <datadir>/postmaster.pid && su postgres -c "pg_ctl -D /var/lib/postgresql/olive-pg -o '-p 5433' -l /tmp/pg-olive.log start"`.
   Ne jamais conclure « les identifiants sont mauvais » avant d'avoir vérifié QUEL
   cluster écoute.

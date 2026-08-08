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

-- Avant le lancement des XP S (02/11/2026) : les matchs Bola à regarder de
-- près. Lecture seule (un select) : à coller dans l'éditeur SQL de Supabase
-- par l'admin, ou à jouer sur un export. Rien n'est écrit.
--
-- Une ligne par match Bola saisi dont la première feuille est arrivée plus
-- de 48 heures après son coup d'envoi (le contrôle adverse : des matchs
-- antidatés, montés des semaines plus tard par des comptes d'accord), ou dont
-- le coup d'envoi tombe plus de 24 heures avant sa création (né dans le
-- passé, ce que match_naissance_gardee refuse désormais). Les XP S ignorent
-- déjà un match saisi plus de sept jours après son jour (lib/sfl/xp-s.ts,
-- semaineXpSBola) et comptent les autres à la semaine de leur saisie ; l'XP
-- et le classement Bola, eux, les comptent tels quels : à l'admin de juger.
--   · ecart_saisie : saisi_le − coup d'envoi ;
--   · donne_xps : faux si la feuille est arrivée plus de sept jours après le jour du match ;
--   · organisateur et joueurs de la feuille, pour reconnaître un groupe d'accord.
select m.id,
       m.jour,
       m.heure,
       p.name as organisateur,
       m.created_at,
       m.saisi_le,
       m.saisi_le - public.coup_d_envoi(m.jour, m.heure) as ecart_saisie,
       public.coup_d_envoi(m.jour, m.heure) < m.created_at - interval '24 hours' as ne_dans_le_passe,
       (m.saisi_le at time zone 'Europe/Paris')::date - m.jour <= 7 as donne_xps,
       m.confirmation_requise as requise,
       case when m.confirmation_requise then public.etat_feuille(m.id) else 'compte' end as etat,
       (select string_agg(q.name, ', ' order by q.name)
          from public.match_joueurs j join public.profiles q on q.id = j.player_id
         where j.match_id = m.id and j.equipe in ('clairs', 'fonces')) as joueurs
  from public.matchs m
  join public.profiles p on p.id = m.organisateur
 where m.mode = 'bola'
   and m.saisi_le is not null
   and (m.saisi_le - public.coup_d_envoi(m.jour, m.heure) > interval '48 hours'
        or public.coup_d_envoi(m.jour, m.heure) < m.created_at - interval '24 hours')
 order by m.saisi_le - public.coup_d_envoi(m.jour, m.heure) desc, m.id;

// Le texte entier de la politique de confidentialité — lu sur la page
// /confidentialite (ouverte à tous, sans compte) et depuis la case de
// l'ouverture (« Lire la politique en entier », consentement.tsx).
//
// Il décrit l'app telle qu'elle est le 22/10/2026, relevée dans le code :
// supabase/schema.sql pour ce qui est gardé et qui le lit, les routes
// /api/photo-studio, /api/agent, /api/ville-devinee et /api/geocode pour ce
// qui part chez un prestataire, lib/sfl/activity.ts pour le journal d'usage,
// lib/server/push-envoi.ts pour le suivi des notifications (23/10).
// Quand l'un de ces endroits change ce qu'il garde ou à qui il l'envoie, ce
// texte change avec lui ; si le changement touche à ce que les joueurs ont
// accepté, VERSION_POLITIQUE aussi (lib/sfl/confidentialite.ts).
//
// Ce n'est pas un avis juridique. Le texte parle au nom de Bola, jamais d'une
// personne (RESPONSABLE, lib/sfl/confidentialite.ts) ; à faire relire avant
// une ouverture au public.
//
// Attention aux espaces : le compilateur de Next (SWC) mange l'espace en tête
// d'un texte JSX qui suit une balise ou une expression quand ce texte court
// sur plusieurs lignes et contient une entité (&apos;). D'où les {" "}
// explicites après certaines balises <Fort>.

import { DATE_POLITIQUE, RESPONSABLE } from "@/lib/sfl/confidentialite";
import { cn } from "@/lib/utils";

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[13px]">
      <h2 className="text-[19px] leading-tight font-bold tracking-tight text-foreground">{titre}</h2>
      {children}
    </section>
  );
}

function Sous({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <h3 className="text-[15px] font-semibold text-foreground">{titre}</h3>
      {children}
    </div>
  );
}

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[14.5px] leading-relaxed text-foreground/70", className)}>{children}</p>;
}

function Liste({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-[8px]">
      {items.map((item, i) => (
        <li key={i} className="flex gap-[10px] text-[14.5px] leading-relaxed text-foreground/70">
          <span aria-hidden className="mt-[10px] size-[4px] shrink-0 rounded-full bg-foreground/40" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Fort({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground/90">{children}</span>;
}

const contact = RESPONSABLE.email ? (
  <>
    écris à{" "}
    <a href={`mailto:${RESPONSABLE.email}`} className="font-semibold text-foreground underline underline-offset-2">
      {RESPONSABLE.email}
    </a>
    , ou à un administrateur en message privé dans l&apos;app
  </>
) : (
  <>écris à un administrateur en message privé dans l&apos;app</>
);

export function TextePolitique() {
  return (
    <article className="flex flex-col gap-[34px]">
      <header>
        <p className="mono-label text-foreground/40">Bola · Bêta fermée</p>
        <h1 className="mt-2 text-[32px] leading-[1.05] font-extrabold tracking-tight">Politique de confidentialité</h1>
        <p className="mt-[13px] text-[13px] text-foreground/45">Version du {DATE_POLITIQUE}</p>
        <P className="mt-[21px]">
          Bola est l&apos;app de la Sunday Five League : la Map des matchs, ta carte de joueur, la ligue et le
          Vestiaire. Cette page dit ce que l&apos;app garde sur toi, pourquoi, qui le voit, et comment tout reprendre.
        </P>
      </header>

      <Section titre="Qui s'en occupe">
        <P>
          {RESPONSABLE.nom}{" "}décide de ce que l&apos;app fait de tes données : c&apos;est le responsable du
          traitement, au sens du RGPD. Les administrateurs de la ligue accèdent à certaines d&apos;entre elles pour
          la faire tourner.
        </P>
        <P>Pour une question ou une demande, {contact}.</P>
      </Section>

      <Section titre="Ce que l'app garde, et pourquoi">
        <Sous titre="Ton compte">
          <Liste
            items={[
              <>
                Ton pseudo, ton nom de joueur et ton mot de passe. Celui que tu choisis est gardé sous une forme
                illisible (une empreinte) : personne ne peut le lire. Celui que la ligue t&apos;a donné à ton arrivée,
                les administrateurs le connaissent : change-le dans Réglages. Si tu te connectes avec Google ou Apple,
                ils nous transmettent ton nom et ton adresse email.
              </>,
              <>
                Ton prénom, ton nom et ton email, que tu confirmes à l&apos;ouverture (« C&apos;est bien toi ? »).
                L&apos;email sert à te joindre et à retrouver ton compte ; il n&apos;apparaît nulle part dans l&apos;app.
              </>,
              <>
                À l&apos;inscription : ta date de naissance, ta taille, ton poids, ta pointure, ta taille de maillot,
                ton pied fort et ton poste. Cette fiche est privée, entre toi et les administrateurs. Elle sert à
                vérifier ton âge, à préparer les maillots et, plus tard, ton personnage.
              </>,
            ]}
          />
        </Sous>

        <Sous titre="Ta carte et tes matchs">
          <P>
            Tes stats (buts, passes, notes, MVP, cartes spéciales, badges, classements), tes réponses aux
            convocations, tes disponibilités, les matchs que tu ouvres ou rejoins, et les feuilles de match.
            C&apos;est le cœur de la ligue : les joueurs de la ligue les voient. Tes votes de fin de match restent
            secrets dans l&apos;app, seul le résultat s&apos;affiche.
          </P>
        </Sous>

        <Sous titre="Ta photo de carte, faite par l'IA">
          <Liste
            items={[
              <>
                Dans le studio « Photo officielle », tu prends un à trois selfies (ou tu les choisis, si la caméra ne
                s&apos;ouvre pas). Ils partent chez <Fort>fal.ai</Fort>, un service de génération d&apos;images, qui
                fait tourner le modèle chargé de la photo : Seedream (ByteDance) pour la photo de studio, Nano Banana
                (Google) pour les filtres Drapeau et Manga. Ces éditeurs peuvent recevoir les images le temps de la
                génération.
              </>,
              <>
                <Fort>Bola ne garde pas tes selfies</Fort>, et demande à fal.ai de ne pas les garder dans son
                historique.
              </>,
              <>
                La photo obtenue, ton visage au maillot Bola retouché par l&apos;IA, est enregistrée chez nous et
                apparaît sur ta carte dans toute l&apos;app : Map, Actus, classements, feuilles de match, Vestiaire,
                profil. Elle est rangée dans un espace public : <Fort>elle se voit sans compte</Fort>, par qui a son
                adresse ; la liste des photos, elle, est réservée aux membres de la ligue.
              </>,
              <>
                Les joueurs peuvent partager des visuels de la ligue hors de l&apos;app (une feuille de match en story,
                par exemple) : ta carte peut y figurer.
              </>,
              <>
                Chaque photo faite est notée (le filtre, la date), pour s&apos;en tenir à 3 par jour ; avec le filtre
                Drapeau, le pays choisi aussi, pour compter les pays de la ligue.
              </>,
              <>
                Tu la retires quand tu veux : Ma carte, puis Ma photo, puis Retirer. Elle quitte nos serveurs ; une
                copie gardée en cache peut mettre un peu de temps à disparaître.
              </>,
            ]}
          />
        </Sous>

        <Sous titre="Hors de l'app : les vidéos et les posts de Bola">
          <P>
            Seulement si tu l&apos;acceptes (une case à part, facultative, à changer quand tu veux dans Réglages) :
            ta carte et ta photo peuvent apparaître dans les vidéos et les visuels que Bola publie, sur les réseaux
            sociaux par exemple, pour mettre en avant les joueurs d&apos;une journée. Pour ces vidéos, ta photo peut
            être confiée à un outil de génération vidéo, comme Magnific. Sans cet accord, Bola ne s&apos;en sert pas
            hors de l&apos;app.
          </P>
        </Sous>

        <Sous titre="Tes quatre photos en pied">
          <P>
            Les quatre photos de l&apos;inscription (face, droite, gauche, dos) sont privées, entre toi et les
            administrateurs. Elles serviront à créer ton personnage, pour les skins. Elles ne sont envoyées à aucune
            IA aujourd&apos;hui ; si ça change, l&apos;app te redemandera ton accord.
          </P>
        </Sous>

        <Sous titre="Ta ville et la Map">
          <Liste
            items={[
              <>
                Ta ville te place sur la Map, que voient les joueurs de la ligue : le centre de ta commune, jamais
                ton adresse. Si tu ne l&apos;as pas donnée, l&apos;app la devine d&apos;après ta connexion (la ville
                que notre hébergeur associe à ton adresse IP, que nous ne gardons pas) ; sans ville, tu es à Lille,
                la ville de la ligue.
              </>,
              <>
                Tu changes de ville, ou tu disparais de la Map (le mode fantôme), dans le catalogue des joueurs, sur
                la Map.
              </>,
              <>
                Ta position exacte ne sert que si tu touches le bouton de localisation, pour te montrer sur la Map :
                elle reste sur ton téléphone.
              </>,
              <>
                Les fonds de carte viennent d&apos;OpenFreeMap, d&apos;Amazon Web Services (le relief) et d&apos;Esri
                (la vue satellite) : ton téléphone leur demande les images de la zone affichée, avec ton adresse IP.
                Les adresses tapées pour un match ou une ville sont cherchées par notre serveur auprès de la
                Géoplateforme de l&apos;IGN et de Photon (Komoot).
              </>,
            ]}
          />
        </Sous>

        <Sous titre="Le Vestiaire et les messages privés">
          <P>
            Tes messages, tes réactions, tes vocaux (une minute au plus), tes photos et tes vidéos (30 secondes au
            plus). Au Vestiaire, les joueurs de la ligue les voient ; les administrateurs peuvent retirer un message
            et couper la parole un temps. Un message privé ne se lit qu&apos;entre vous deux : les administrateurs
            ne le voient pas dans l&apos;app. Tu retires tes messages quand tu veux.
          </P>
        </Sous>

        <Sous titre="Les notifications">
          <P>
            Si tu les actives, ton téléphone nous donne une adresse d&apos;abonnement au service de notifications
            d&apos;Apple, de Google ou de Mozilla. Les messages y passent chiffrés : seul ton téléphone peut les lire.
            On garde aussi tes réglages, où tu en es dans le Vestiaire, et le fait qu&apos;il soit ouvert à
            l&apos;écran, pour ne pas te notifier pendant que tu le lis.
          </P>
          <P>
            Pour savoir lesquelles servent, chaque notification envoyée est notée avec son motif (une réponse au
            Vestiaire, le rappel d&apos;un match…), jamais avec son texte : si elle est arrivée, si tu l&apos;as
            touchée, et si tu as fait ce qu&apos;elle proposait (écrire, réagir, répondre à une invitation). L&apos;app
            note aussi ta réponse quand elle te propose de les activer, et chaque jour si elles sont activées sur ton
            téléphone. Seuls les administrateurs voient ce suivi (Activité et rétention).
          </P>
        </Sous>

        <Sous titre="Bola Agent, le coach">
          <Liste
            items={[
              <>Ta conversation avec le coach est gardée pour qu&apos;il se souvienne de toi. Toi seul la lis.</>,
              <>
                À chaque question, ton message, la conversation récente et ton dossier (tes stats, tes derniers
                matchs avec les prénoms de tes coéquipiers et de tes adversaires, tes classements, tes badges) partent
                chez <Fort>Anthropic</Fort>, qui fait tourner Claude, le modèle qui te répond. D&apos;après ses
                conditions, Anthropic n&apos;entraîne pas ses modèles sur ces échanges et les efface de ses serveurs
                sous 30 jours, sauf abus ou obligation légale.
              </>,
              <>Quand le coach illustre un geste, une description écrite, sans photo de toi, part chez fal.ai.</>,
              <>
                Si tu lui parles d&apos;une douleur ou d&apos;une blessure, c&apos;est une donnée de santé : ne dis
                que ce que tu veux. Le coach n&apos;est pas un médecin.
              </>,
              <>
                Les administrateurs ne voient que des statistiques : le sujet de chaque réponse en un mot
                (« santé », « nutrition »…), jamais ce que vous vous dites.
              </>,
            ]}
          />
        </Sous>

        <Sous titre="Le journal d'usage">
          <P>
            Pour améliorer la bêta, l&apos;app note quand tu l&apos;ouvres, les pages que tu regardes, le temps que
            tu y passes (un signal toutes les 90 secondes tant qu&apos;elle est à l&apos;écran) et quelques gestes :
            une réponse à une convocation, un vote, une recherche (le joueur ou la journée cherchés), une partie dans
            l&apos;Arène. Les administrateurs le lisent joueur par joueur (Activité et rétention), pour voir ce qui
            plaît et relancer ceux qui décrochent. Rien n&apos;est noté avant que tu aies accepté cette politique, et
            tu peux demander qu&apos;il s&apos;arrête pour toi.
          </P>
        </Sous>

        <Sous titre="Sur ton téléphone">
          <P>
            L&apos;app y garde ta session, tes réglages et des copies (photos, noms, villes) pour s&apos;ouvrir vite,
            un identifiant de séance pour le journal d&apos;usage, et les photos que tu fais au studio, pour choisir
            entre elles : seule celle que tu poses sur ta carte part chez nous. Aucun cookie publicitaire, aucun
            traceur d&apos;une autre entreprise.
          </P>
        </Sous>
      </Section>

      <Section titre="Qui voit quoi">
        <Liste
          items={[
            <>
              <Fort>Les joueurs de la ligue :</Fort> ta carte et ta photo, ton nom et ton pseudo, ta ville (sauf en
              mode fantôme), tes stats, tes présences, tes disponibilités, tes matchs publics, tes messages du
              Vestiaire.
            </>,
            <>
              <Fort>Les administrateurs, en plus :</Fort>{" "}ton email, ta fiche, tes photos en pied, ton journal
              d&apos;usage, le suivi de tes notifications, les statistiques du coach.
            </>,
            <>
              <Fort>Toi seul :</Fort> ta conversation avec le coach. <Fort>Toi et ton correspondant :</Fort> vos
              messages privés.
            </>,
            <>
              <Fort>Tout le monde, même sans compte :</Fort> ta photo de carte.
            </>,
            <>
              <Fort>Personne :</Fort> le mot de passe que tu as choisi.
            </>,
          ]}
        />
      </Section>

      <Section titre="Nos prestataires">
        <P>Ils traitent tes données pour nous, et seulement pour faire marcher Bola :</P>
        <Liste
          items={[
            <>
              <Fort>Supabase</Fort> : la base de données, les comptes et les fichiers, sur des serveurs en Irlande
              (Union européenne).
            </>,
            <>
              <Fort>Vercel</Fort>{" "}: héberge l&apos;app et ses fonctions serveur (entreprise américaine).
            </>,
            <>
              <Fort>fal.ai</Fort> : fait les photos de carte et les images du coach (États-Unis), avec les éditeurs
              des modèles (ByteDance, Google).
            </>,
            <>
              <Fort>Anthropic</Fort> : fait tourner Bola Agent (États-Unis).
            </>,
            <>
              <Fort>Apple, Google, Mozilla</Fort> : acheminent les notifications, chiffrées ; Google et Apple aussi
              quand tu te connectes avec eux.
            </>,
            <>
              <Fort>OpenFreeMap, Amazon Web Services, Esri, l&apos;IGN, Komoot</Fort>{" "}: les cartes et la recherche
              d&apos;adresses.
            </>,
            <>
              <Fort>Pour les vidéos</Fort>, et seulement avec ton accord : un outil de génération vidéo, comme
              Magnific.
            </>,
          ]}
        />
        <P>
          Certains sont établis hors de l&apos;Union européenne, surtout aux États-Unis. Ces transferts
          s&apos;appuient sur les garanties prévues par le RGPD : les clauses contractuelles types de la Commission
          européenne, ou le cadre de protection des données UE–États-Unis pour les entreprises qui y adhèrent.
        </P>
        <P>
          <Fort>On ne vend pas tes données</Fort>, et on ne s&apos;en sert pas pour de la publicité.
        </P>
      </Section>

      <Section titre="Sur quelles bases">
        <Liste
          items={[
            <>
              <Fort>Le service que tu demandes</Fort> en créant ton compte (RGPD, article 6.1.b) : ton compte, ta
              fiche, la ligue et tes stats, ta ville sur la Map, le Vestiaire, les notifications que tu actives.
            </>,
            <>
              <Fort>Ton accord</Fort>{" "}(article 6.1.a), donné en cochant la case et en te servant de ces fonctions :
              ta photo de carte faite par l&apos;IA et son usage dans l&apos;app, tes photos en pied, Bola Agent. À
              part, s&apos;il est donné : l&apos;usage de ta carte hors de l&apos;app. Ce que tu confies au coach sur
              ta santé repose sur ton accord explicite (article 9.2.a).
            </>,
            <>
              <Fort>Notre intérêt légitime</Fort>{" "}à faire tourner et améliorer la bêta sans abus (article 6.1.f) : le
              journal d&apos;usage, le suivi des notifications, les limites par jour, la modération du Vestiaire, la
              ville devinée pour la Map. Tu peux t&apos;y opposer (voir « Tes droits »).
            </>,
          ]}
        />
        <P>
          Pendant la bêta fermée, cocher la case est la condition pour entrer dans l&apos;app : ta carte, avec ta
          photo, en est le cœur. Tu peux retirer ton accord à tout moment (voir « Tes droits ») ; ce retrait ne
          touche pas à ce qui a été fait avant.
        </P>
      </Section>

      <Section titre="Combien de temps">
        <Liste
          items={[
            <>
              Ton compte, ta fiche, tes stats, tes messages, ta conversation avec le coach, tes abonnements aux
              notifications : tant que ton compte existe.
            </>,
            <>Tes selfies : jamais gardés par Bola.</>,
            <>Ta photo de carte : jusqu&apos;à ce que tu la retires, ou que ton compte soit supprimé.</>,
            <>Le journal d&apos;usage et le suivi des notifications : 13 mois au plus.</>,
            <>Ton accord (la case cochée, sa date, sa version) : tant que ton compte existe, pour pouvoir le prouver.</>,
            <>
              Quand ton compte est supprimé, tout cela est effacé sous 30 jours. Les feuilles des matchs déjà joués
              restent dans l&apos;histoire de la ligue ; à ta demande, ton nom y est remplacé.
            </>,
          ]}
        />
      </Section>

      <Section titre="Tes droits">
        <P>
          Tu peux demander à voir tes données, les corriger, les effacer, en limiter l&apos;usage, t&apos;opposer à
          un usage, les récupérer dans un format lisible, retirer ton accord, et dire ce qu&apos;elles deviennent
          après ta mort.
        </P>
        <Liste
          items={[
            <>
              <Fort>Seul, dans l&apos;app :</Fort>{" "}ton nom, ton pseudo et ton email (Ma carte, en touchant ton nom),
              ta ville et le mode fantôme (Map), ta photo (Ma carte, Ma photo, Retirer), tes messages, tes
              notifications (Réglages), l&apos;usage de ta carte hors de l&apos;app (Réglages, Confidentialité).
            </>,
            <>
              <Fort>Pour le reste</Fort>{" "}(une copie de tes données, la suppression de ton compte, la fin du journal
              d&apos;usage ou du suivi de tes notifications) : {contact}. Réponse sous un mois.
            </>,
            <>
              Si tu penses que tes droits ne sont pas respectés, tu peux saisir la CNIL, sur{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                cnil.fr
              </a>
              .
            </>,
          ]}
        />
      </Section>

      <Section titre="Moins de 15 ans">
        <P>
          On peut s&apos;inscrire dès 12 ans. Avant 15 ans, ton accord ne suffit pas : un de tes parents doit le
          donner avec toi, pour tes données comme pour ta photo. L&apos;app te le demande.
        </P>
      </Section>

      <Section titre="Sécurité">
        <P>
          Seuls les joueurs acceptés par la ligue y entrent. Des règles d&apos;accès, dans la base, gardent privés ta
          fiche, ta conversation avec le coach et tes messages privés. Les vocaux, les photos et vidéos du
          Vestiaire, les photos en pied et les images du coach sont dans des espaces privés, ouverts par des liens
          temporaires. Les clés des prestataires restent sur le serveur.
        </P>
      </Section>

      <Section titre="Les changements">
        <P>
          Bola est en bêta : cette politique bougera avec l&apos;app, et chaque version porte sa date. Si un
          changement touche à ce que tu as accepté, l&apos;app te redemande ton accord à l&apos;ouverture.
        </P>
      </Section>
    </article>
  );
}

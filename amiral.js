/**
 * V37 — MOTEUR PAR RÈGLES SYNTAXIQUES (Portage JavaScript)
 * Objectifs :
 * - Éliminer les sorties du type "Nous." / "Il." (phrases coupées)
 * - Verrouiller la présence d’un GV fini
 * - Corriger des GN de base fautifs
 * - Réduire les bégaiements
 * - Ajouter des déterminants possessifs
 */

// =============================================================================
// OUTILS DE BASE (RANDOM & UTILS)
// =============================================================================

function choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function sample(arr, n) {
    // Mélange simple et prise des n premiers
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

// =============================================================================
// PARAMÈTRES
// =============================================================================

const NOMBRE_DE_PHRASES_SOUHAITE = 120;
const MAX_PROFONDEUR_RECURSIVITE_CN = 4;
const MAX_PROFONDEUR_RECURSIVITE_SUB = 3;
const MAX_EXPANSION_DEPTH = 60;
const MAX_RETRY_SENTENCE = 30;
const POSSESSIVE_DET_PROB = 0.22;

// =============================================================================
// SECTION 1 — VOCABULAIRE
// =============================================================================

const GN_MS_BASE = [
    "médium", "imaginaire", "support", "sujet", "geste", "protocole",
    "dispositif", "écart", "signal", "format", "vecteur", "schème", "contexte",
    "diagramme", "médioscope", "robot-orchestre", "flux", "champ", "prisme", "opérateur",
    "régime", "artefact", "réseau", "corps", "palimpseste", "sillage", "décentrement",
    "horizon d'attente", "simulacre", "moment", "temps réel",
    "principe", // PATCH
    "interstice", "paradigme", "substrat", "référentiel", "effet-mémoire", "système",
    "seuil", "rapport au monde", "mythe", "appareil conceptuel", "temps-image",
    "devenir-machine", "impératif", "cycle", "espace",
    "signifié", "processus", "mode d'existence", "espace discursif", "chiffre de l'oubli",
    "terrain", "concept", "référentiel ontologique", "modèle", "flux de données", "territoire affectif",
    "langage machinique", "horizon phénoménologique", "cadre d'interprétation", "préalable",
    "objet-frontière", "code source", "protocole d'échange", "fétichisme du médium", "mécanisme de visée",
    "temps hétérogène", "imaginaire", "potentiel ontologique", "geste d'inscription", "récepteur", "savoir-faire", "temps sériel"
];

const GN_FS_BASE = [
    "sphère", "trace", "médiatisation", "technologie", "médiologie", "médiation",
    "transmission", "instance", "opération", "structure", "circulation", "interface", "occurrence",
    "archive", "sémiose", "texture", "matrice", "surface", "stabilisation", "condition",
    "boucle de rétroaction", "strate", "situation", "neurosphère", "réversibilité", "rupture",
    "dimension", "réflexivité", "échelle", "vérité du sujet", "condition de possibilité",
    "infrastructure", "logique interne", "puissance d'agir", "forme-mémoire", "tension",
    "sémantique de l'objet", "historicité", "grammaire du visible", "phénoménologie de l'écran", "temporalité",
    "dérive", "chimère", "hégémonie de l'image", "cartographie", "posture",
    "contingence", "dématérialisation", "évidence", "réappropriation", "force-travail",
    "esthétique", "agence", "problématique", "dynamique", "fiction théorique",
    "modalité d'accès", "pratique curatoriale", "économie de l'attention", "zone de friction", "poétique de l'archive",
    "surface d'inscription", "mémoire", "fiction", "catégorie", "critique",
    "structure d'accueil", "potentialité", "connaissance", "puissance de déconstruction",
    "condition liminale", "matrice d'interférence", "pratique de l'écart",
    "politique du code", "visée", "structure de pouvoir", "rhétorique du flux", "relation de tension", "dynamique d'obsolescence"
];

const GN_MP_BASE = [
    "rituels", "systèmes d'encodage", "appareils", "matériaux et outils", "régimes de visibilité", "protocoles",
    "dispositifs", "réseaux de neurones", "affects", "objets", "figures de l'altérité", "modes de présence",
    "gestes de déconstruction", "processus d'indexation", "mécanismes de contrôle",
    "énoncés", "supports d'enregistrement", "modes d'intermédiation", "acteurs", "codes binaires",
    "espaces de projection", "indices", "concepts", "régimes d'historicité", "corps",
    "paradoxes", "schèmes perceptifs", "outils d'analyse", "moments", "vecteurs",
    "cycles d'information" // PATCH
];

const GN_FP_BASE = [
    "narrations", "données", "archéologies", "dynamiques", "temporalités",
    "frontières", "conditions de production",
    "écritures", "séries",
    "instances", "traces", "postures", "logiques", "puissances",
    "matrices", "conditions d'apparition", "ruptures", "stratégies", "conditions de réception"
];

const GN_BASE_MAP = {};

function map_gn_bases(gn_list, g, n) {
    gn_list.forEach(gn => {
        GN_BASE_MAP[gn] = { g: g, n: n };
    });
}

map_gn_bases(GN_MS_BASE, 'm', 's');
map_gn_bases(GN_FS_BASE, 'f', 's');
map_gn_bases(GN_MP_BASE, 'm', 'p');
map_gn_bases(GN_FP_BASE, 'f', 'p');

const GNDefini = Object.keys(GN_BASE_MAP);
const GNIndefini_Singulier = GNDefini.filter(gn => GN_BASE_MAP[gn].n === 's');
const GNIndefini_Pluriel = GNDefini.filter(gn => GN_BASE_MAP[gn].n === 'p');
const GNIndefini = [...GNIndefini_Singulier, ...GNIndefini_Pluriel];
const GNComplexe = GNDefini;

const GNPersonnel = [{ v: "nous", n: "p", g: "m" }, { v: "on", n: "s", g: "m" }];
const GNImpersonnel = [{ v: "il", n: "s", g: "m" }];

// =============================================================================
// VERBES
// =============================================================================

const GVTransitif = {
    "réorganiser": { "s": "réorganise", "p": "réorganisent" }, "interroger": { "s": "interroge", "p": "interrogent" },
    "activer": { "s": "active", "p": "activent" }, "configurer": { "s": "configure", "p": "configurent" },
    "articuler": { "s": "articule", "p": "articulent" }, "conditionner": { "s": "conditionne", "p": "conditionnent" },
    "inscrire": { "s": "inscrit", "p": "inscrivent" }, "déplacer": { "s": "déplace", "p": "déplacent" },
    "générer": { "s": "génère", "p": "génèrent" }, "produire": { "s": "produit", "p": "produisent" },
    "moduler": { "s": "module", "p": "modulent" }, "stabiliser": { "s": "stabilise", "p": "stabilisent" },
    "indexer": { "s": "indexe", "p": "indexent" }, "transférer": { "s": "transfère", "p": "transfèrent" },
    "reformuler": { "s": "reformule", "p": "reformulent" }, "encadrer": { "s": "encadre", "p": "encadrent" },
    "intégrer": { "s": "intègre", "p": "intègrent" }, "traduire": { "s": "traduit", "p": "traduisent" },
    "lier": { "s": "lie", "p": "lient" }, "distribuer": { "s": "distribue", "p": "distribuent" },
    "manifester": { "s": "manifeste", "p": "manifestent" }, "saisir": { "s": "saisit", "p": "saisissent" },
    "gérer": { "s": "gère", "p": "gèrent" }, "fonder": { "s": "fonde", "p": "fondent" },
    "actualiser": { "s": "actualise", "p": "actualisent" }, "déconstruire": { "s": "déconstruit", "p": "déconstruisent" },
    "circonscrire": { "s": "circonscrit", "p": "circonscrivent" }, "opacifier": { "s": "opacifie", "p": "opacifient" },
    "contingenter": { "s": "contingente", "p": "contingentent" }, "médiatiser": { "s": "médiatise", "p": "médiatisent" },
    "historiciser": { "s": "historicise", "p": "historicisent" }, "cartographier": { "s": "cartographie", "p": "cartographient" },
    "dévoiler": { "s": "dévoile", "p": "dévoilent" }, "interpeller": { "s": "interpelle", "p": "interpellent" },
    "formaliser": { "s": "formalise", "p": "formalisent" }, "essentialiser": { "s": "essentialise", "p": "essentialisent" },
    "paradoxaliser": { "s": "paradoxalise", "p": "paradoxalisent" }, "subjectiviser": { "s": "subjectivise", "p": "subjectivisent" },
    "reconfigurer": { "s": "reconfigure", "p": "reconfigurent" }, "subvertir": { "s": "subvertit", "p": "subvertissent" },
    "encrypter": { "s": "encrypte", "p": "encryptent" }, "potentialiser": { "s": "potentialise", "p": "potentialisent" },
    "problématiser": { "s": "problématise", "p": "problématisent" }, "réifier": { "s": "réifie", "p": "réifient" },
    "dénaturaliser": { "s": "dénaturalise", "p": "dénaturalisent" }, "soutenir": { "s": "soutient", "p": "soutiennent" },
    "affirmer": { "s": "affirme", "p": "affirment" }, "montrer": { "s": "montre", "p": "montrent" },
    "postuler": { "s": "postule", "p": "postulent" }, "suggérer": { "s": "suggère", "p": "suggèrent" },
    "démontrer": { "s": "démontre", "p": "démontrent" }
};

const GVAttributif = {
    "être": { "s": "est", "p": "sont" }, "sembler": { "s": "semble", "p": "semblent" },
    "apparaître": { "s": "apparaît", "p": "apparaissent" }, "demeurer": { "s": "demeure", "p": "demeurent" },
    "rester": { "s": "reste", "p": "restent" }, "devenir": { "s": "devient", "p": "deviennent" }
};

const GVIntransitif = {
    "émerger": { "s": "émerge", "p": "émergent" }, "persister": { "s": "persiste", "p": "persistent" },
    "circuler": { "s": "circule", "p": "circulent" }, "résider": { "s": "réside", "p": "résident" },
    "advenir": { "s": "advient", "p": "adviennent" }, "se déployer": { "s": "se déploie", "p": "se déploient" },
    "subsister": { "s": "subsiste", "p": "subsistent" }, "opérer": { "s": "opère", "p": "opèrent" }
};

const GVIntroductif = GVTransitif;
const GVModalPersonal = { "devoir": { "s": "doit", "p": "doivent" }, "pouvoir": { "s": "peut", "p": "peuvent" } };
const GVModalImpersonal = { "falloir": { "s": "faut", "p": "faut" } };

const GVReflexifAttributif = {
    "se constituer": { "s": "se constitue", "p": "se constituent" },
    "se définir": { "s": "se définit", "p": "se définissent" },
    "se manifester": { "s": "se manifeste", "p": "se manifestent" },
    "se reconfigurer": { "s": "se reconfigure", "p": "se reconfigurent" },
    "s'inscrire": { "s": "s'inscrit", "p": "s'inscrivent" },
    "s'avérer": { "s": "s'avère", "p": "s'avèrent" },
    "se déployer": GVIntransitif["se déployer"]
};

const VERBES_PASSIFS = {
    "conditionner": "conditionné", "intégrer": "intégré", "structurer": "structuré", "archiver": "archivé", "analyser": "analysé",
    "transférer": "transféré", "distribuer": "distribué", "moduler": "modulé", "gérer": "géré",
    "produire": "produit", "lier": "lié", "médiatiser": "médiatisé", "historiciser": "historicisé",
    "cartographier": "cartographié", "dévoiler": "dévoilé", "formaliser": "formalisé",
    "problématiser": "problématisé", "réifier": "réifié",
    "circonscrire": "circonscrit", "déconstruire": "déconstruit",
    "subvertir": "subverti"
};

const GVPassif = Object.assign({}, VERBES_PASSIFS);

const GVInfinitifTransitif = Object.keys(GVTransitif);
const GVInfinitifIntransitif = Object.keys(GVIntransitif);
const GVInfinitif = [...GVInfinitifTransitif, ...GVInfinitifIntransitif];

const GV_PERSONNEL_NOUS_EXPLICIT = {
    "réorganiser": "réorganisons", "interroger": "interrogeons", "activer": "activons", "configurer": "configurons",
    "articuler": "articulons", "conditionner": "conditionnons", "inscrire": "inscrivons", "déplacer": "déplaçons",
    "générer": "générons", "produire": "produisons", "moduler": "modulons", "stabiliser": "stabilisons",
    "indexer": "indexons", "transférer": "transférons", "reformuler": "reformulons", "encadrer": "encadrons",
    "intégrer": "intégrons", "traduire": "traduisons", "lier": "lions", "distribuer": "distribuons",
    "manifester": "manifestons", "saisir": "saisissons", "gérer": "gérons", "fonder": "fondons",
    "actualiser": "actualisons", "déconstruire": "déconstruisons", "circonscrire": "circonscrivons",
    "opacifier": "opacifions", "contingenter": "contingentons", "médiatiser": "médiatisons",
    "historiciser": "historicisons", "cartographier": "cartographions", "dévoiler": "dévoilons",
    "interpeller": "interpellons", "formaliser": "formalisons", "essentialiser": "essentialisons",
    "paradoxaliser": "paradoxalisons", "subjectiviser": "subjectivisons", "reconfigurer": "reconfigurons",
    "subvertir": "subvertissons", "encrypter": "encryptons", "potentialiser": "potentialisons",
    "problématiser": "problématisons", "réifier": "réifions", "dénaturaliser": "dénaturalisons",
    "soutenir": "soutenons", "affirmer": "affirmons", "montrer": "montrons", "postuler": "postulons",
    "suggérer": "suggérons", "démontrer": "démontrons",
    "devoir": "devons", "pouvoir": "pouvons",
    "être": "sommes", "sembler": "semblons", "apparaître": "apparaissons", "demeurer": "demeurons",
    "rester": "restons", "devenir": "devenons",
    "émerger": "émergeons", "persister": "persistons", "circuler": "circulons", "résider": "résidons",
    "advenir": "advenons", "subsister": "subsistons", "opérer": "opérons"
};

// =============================================================================
// ADJECTIFS
// =============================================================================

const ADJ_MORPHOLOGY = {
    "ambivalent": { "m": { "s": "ambivalent", "p": "ambivalents" }, "f": { "s": "ambivalente", "p": "ambivalentes" } },
    "latent": { "m": { "s": "latent", "p": "latents" }, "f": { "s": "latente", "p": "latentes" } },
    "contingent": { "m": { "s": "contingent", "p": "contingents" }, "f": { "s": "contingente", "p": "contingentes" } },
    "convergent": { "m": { "s": "convergent", "p": "convergents" }, "f": { "s": "convergente", "p": "convergentes" } },
    "signifiant": { "m": { "s": "signifiant", "p": "signifiants" }, "f": { "s": "signifiante", "p": "signifiantes" } },
    "critique": { "m": { "s": "critique", "p": "critiques" }, "f": { "s": "critique", "p": "critiques" } },
    "dialectique": { "m": { "s": "dialectique", "p": "dialectiques" }, "f": { "s": "dialectique", "p": "dialectiques" } },
    "heuristique": { "m": { "s": "heuristique", "p": "heuristiques" }, "f": { "s": "heuristique", "p": "heuristiques" } },
    "technique": { "m": { "s": "technique", "p": "techniques" }, "f": { "s": "technique", "p": "techniques" } },
    "paradoxal": { "m": { "s": "paradoxal", "p": "paradoxaux" }, "f": { "s": "paradoxale", "p": "paradoxales" } },
    "transcendantal": { "m": { "s": "transcendantal", "p": "transcendantaux" }, "f": { "s": "transcendantale", "p": "transcendantales" } },
    "structurel": { "m": { "s": "structurel", "p": "structurels" }, "f": { "s": "structurelle", "p": "structurelles" } },
    "idéel": { "m": { "s": "idéel", "p": "idéels" }, "f": { "s": "idéelle", "p": "idéelles" } },
    "fragmenté": { "m": { "s": "fragmenté", "p": "fragmentés" }, "f": { "s": "fragmentée", "p": "fragmentées" } },
    "complet": { "m": { "s": "complet", "p": "complets" }, "f": { "s": "complète", "p": "complètes" } },
    "décentré": { "m": { "s": "décentré", "p": "décentrés" }, "f": { "s": "décentrée", "p": "décentrées" } },
    "sous-jacent": { "m": { "s": "sous-jacent", "p": "sous-jacents" }, "f": { "s": "sous-jacente", "p": "sous-jacentes" } },
    "opératoire": { "m": { "s": "opératoire", "p": "opératoires" }, "f": { "s": "opératoire", "p": "opératoires" } },
    "instable": { "m": { "s": "instable", "p": "instables" }, "f": { "s": "instable", "p": "instables" } },
    "matriciel": { "m": { "s": "matriciel", "p": "matriciels" }, "f": { "s": "matricielle", "p": "matricielles" } },
    "invisible": { "m": { "s": "invisible", "p": "invisibles" }, "f": { "s": "invisible", "p": "invisibles" } },
    "omniprésent": { "m": { "s": "omniprésent", "p": "omniprésents" }, "f": { "s": "omniprésente", "p": "omniprésentes" } },
    "réversible": { "m": { "s": "réversible", "p": "réversibles" }, "f": { "s": "réversible", "p": "réversibles" } },
    "virtuel": { "m": { "s": "virtuel", "p": "virtuels" }, "f": { "s": "virtuelle", "p": "virtuelles" } },
    "essentiel": { "m": { "s": "essentiel", "p": "essentiels" }, "f": { "s": "essentielle", "p": "essentielles" } },
    "systémique": { "m": { "s": "systémique", "p": "systémiques" }, "f": { "s": "systémique", "p": "systémiques" } },
    "performant": { "m": { "s": "performant", "p": "performants" }, "f": { "s": "performante", "p": "performantes" } },
    "sémantique": { "m": { "s": "sémantique", "p": "sémantiques" }, "f": { "s": "sémantique", "p": "sémantiques" } },
    "herméneutique": { "m": { "s": "herméneutique", "p": "herméneutiques" }, "f": { "s": "herméneutique", "p": "herméneutiques" } },
    "ontologique": { "m": { "s": "ontologique", "p": "ontologiques" }, "f": { "s": "ontologique", "p": "ontologiques" } },
    "paradigmatique": { "m": { "s": "paradigmatique", "p": "paradigmatiques" }, "f": { "s": "paradigmatique", "p": "paradigmatiques" } },
    "opératif": { "m": { "s": "opératif", "p": "opératifs" }, "f": { "s": "opérative", "p": "opératives" } },
    "rhizomatique": { "m": { "s": "rhizomatique", "p": "rhizomatiques" }, "f": { "s": "rhizomatique", "p": "rhizomatiques" } },
    "dénaturalisé": { "m": { "s": "dénaturalisé", "p": "dénaturalisés" }, "f": { "s": "dénaturalisée", "p": "dénaturalisées" } },
    "chiffré": { "m": { "s": "chiffré", "p": "chiffrés" }, "f": { "s": "chiffrée", "p": "chiffrées" } },
    "spectral": { "m": { "s": "spectral", "p": "spectraux" }, "f": { "s": "spectrale", "p": "spectrales" } },
    "archivistique": { "m": { "s": "archivistique", "p": "archivistiques" }, "f": { "s": "archivistique", "p": "archivistiques" } },
    "curatorial": { "m": { "s": "curatorial", "p": "curatoriaux" }, "f": { "s": "curatoriale", "p": "curatoriales" } },
    "intermédié": { "m": { "s": "intermédié", "p": "intermédiés" }, "f": { "s": "intermédiée", "p": "intermédiées" } },
    "bio-politique": { "m": { "s": "bio-politique", "p": "bio-politiques" }, "f": { "s": "bio-politique", "p": "bio-politiques" } },
    "subjectif": { "m": { "s": "subjectif", "p": "subjectifs" }, "f": { "s": "subjective", "p": "subjectives" } },
    "fragmentaire": { "m": { "s": "fragmentaire", "p": "fragmentaires" }, "f": { "s": "fragmentaire", "p": "fragmentaires" } },
    "historique": { "m": { "s": "historique", "p": "historiques" }, "f": { "s": "historique", "p": "historiques" } },
    "spéculatif": { "m": { "s": "spéculatif", "p": "spéculatifs" }, "f": { "s": "spéculative", "p": "spéculatives" } },
    "réifié": { "m": { "s": "réifié", "p": "réifiés" }, "f": { "s": "réifiée", "p": "réifiées" } },
    "liminal": { "m": { "s": "liminal", "p": "liminaux" }, "f": { "s": "liminale", "p": "liminales" } },
    "haptique": { "m": { "s": "haptique", "p": "haptiques" }, "f": { "s": "haptique", "p": "haptiques" } },
    "produit": { "m": { "s": "produit", "p": "produits" }, "f": { "s": "produite", "p": "produites" } },
    "circonscrit": { "m": { "s": "circonscrit", "p": "circonscrits" }, "f": { "s": "circonscrite", "p": "circonscrites" } },
    "déconstruit": { "m": { "s": "déconstruit", "p": "déconstruits" }, "f": { "s": "déconstruite", "p": "déconstruites" } },
    "subverti": { "m": { "s": "subverti", "p": "subvertis" }, "f": { "s": "subvertie", "p": "subverties" } },
    "lié": { "m": { "s": "lié", "p": "liés" }, "f": { "s": "liée", "p": "liées" } }
};

// Ajout des participes passés s'ils ne sont pas déjà là
Object.entries(VERBES_PASSIFS).forEach(([base, pp]) => {
    if (!ADJ_MORPHOLOGY[pp]) {
        ADJ_MORPHOLOGY[pp] = {
            "m": { "s": pp, "p": pp + (pp.endsWith("s") ? "" : "s") },
            "f": { "s": pp + "e", "p": pp + "es" }
        };
    }
});

const ADJECTIFS_DISPONIBLES = Object.keys(ADJ_MORPHOLOGY);
const ADJ_MS = [], ADJ_FS = [], ADJ_MP = [], ADJ_FP = [];

Object.values(ADJ_MORPHOLOGY).forEach(forms => {
    ADJ_MS.push(forms.m.s);
    ADJ_FS.push(forms.f.s);
    ADJ_MP.push(forms.m.p);
    ADJ_FP.push(forms.f.p);
});

const AdvConnecteur = ["De plus", "Par ailleurs", "En outre", "Dès lors", "Toutefois", "Néanmoins", "De surcroît", "Nonobstant", "Ainsi", "Également"];
const Coordination = ["Or", "De fait", "Aussi", "Cependant", "Inversement", "De ce fait"];
const AdvArgumentatif = ["En définitive", "Fondamentalement", "En ce sens", "De manière intrinsèque", "Subsidiairement", "Globalement", "Épistémologiquement parlant"];
const AdjDetache = ["Concrètement", "Historiquement", "Logiquement", "Philosophiquement", "Conceptuellement", "Sémiotiquement", "Typiquement"];
const Gerondif = ["En analysant le flux", "En interrogeant l'archive", "En configurant le dispositif", "En déconstruisant le support", "En historicisant l'instance", "En formalisant le protocole"];

// =============================================================================
// OUTILS GRAMMATICAUX
// =============================================================================

const VOWELS = ['a', 'e', 'i', 'o', 'u', 'h', 'y', 'é', 'è', 'à', 'ô', 'ê', 'ï', 'ù', 'û', 'ü', 'œ'];

function _starts_with_vowel(s) {
    if (!s) return false;
    const first = s.trim().charAt(0).toLowerCase();
    return VOWELS.includes(first);
}

function _select_pronoun_from_info(g, n) {
    if (n === "p") return g === "m" ? "ils" : "elles";
    return g === "m" ? "il" : "elle";
}

function accorder_attribut(attribut_base, sujet_g, sujet_n) {
    if (ADJ_MORPHOLOGY[attribut_base]) {
        return ADJ_MORPHOLOGY[attribut_base][sujet_g][sujet_n];
    }

    let attribut = attribut_base.trim();

    if (sujet_g === 'f' && !['e', 'x', 's', 't'].some(end => attribut.endsWith(end))) {
        attribut += 'e';
    }

    if (sujet_n === 'p' && !['s', 'x'].some(end => attribut.endsWith(end)) && !attribut.endsWith('aux')) {
        if (attribut.endsWith('al')) {
            attribut = attribut.slice(0, -2) + 'aux';
        } else {
            attribut += 's';
        }
    }
    return attribut.trim();
}

function conjuguer_verbe(verbe_dict, sujet_n, sujet_g = "m", verbe_cle = null, voix = 'active', sujet_v = null) {
    if (verbe_cle === null) {
        verbe_cle = choice(Object.keys(verbe_dict));
    }

    if (sujet_v) {
        const sv = sujet_v.toLowerCase().trim();

        if (sv === "nous") {
            let base_inf = verbe_cle;
            if (base_inf.startsWith("se ") || base_inf.startsWith("s'")) {
                base_inf = base_inf.replace(/^s'|^se\s/, "");
            }
            if (GV_PERSONNEL_NOUS_EXPLICIT[base_inf]) {
                return GV_PERSONNEL_NOUS_EXPLICIT[base_inf];
            }
            if (base_inf.endsWith("er")) return base_inf.slice(0, -2) + "ons";
            if (base_inf.endsWith("ir")) return base_inf.slice(0, -2) + "issons";
            if (base_inf.endsWith("re")) return base_inf.slice(0, -2) + "ons";
            return base_inf;
        }

        if (sv === "on") sujet_n = "s";
        if (sv === "il" && verbe_cle === "falloir") sujet_n = "s";
    }

    if (verbe_cle === 'falloir') {
        return verbe_dict[verbe_cle]['s'];
    }

    if (voix === 'passive' && VERBES_PASSIFS[verbe_cle]) {
        const pp = VERBES_PASSIFS[verbe_cle];
        const pp_acc = accorder_attribut(pp, sujet_g, sujet_n);
        const etre = GVAttributif["être"][sujet_n];
        return `${etre} ${pp_acc}`;
    }

    if (verbe_dict[verbe_cle] && verbe_dict[verbe_cle][sujet_n]) {
        return verbe_dict[verbe_cle][sujet_n];
    }
    
    // Fallback lookups
    if (GVTransitif[verbe_cle] && GVTransitif[verbe_cle][sujet_n]) return GVTransitif[verbe_cle][sujet_n];
    if (GVIntransitif[verbe_cle] && GVIntransitif[verbe_cle][sujet_n]) return GVIntransitif[verbe_cle][sujet_n];

    return "";
}

function eliminer_article_devant_voyelle(text) {
    let t = text;
    t = t.replace(/\b(le|la)\s+([aeiouyéèàôêïh])/gi, "l'$2");
    t = t.replace(/\bde\s+([aeiouyéèàôêïh])/gi, "d'$1");
    t = t.replace(/\bque\s+([aeiouyéèàôêïh])/gi, "qu'$1");
    t = t.replace(/\bse\s+([aeiouyéèàôêïh])/gi, "s'$1");
    return t.replace(/\s+/g, " ").trim();
}

function _get_base_gn_info(gn_base_str) {
    return GN_BASE_MAP[gn_base_str] || { g: 'm', n: 's' };
}

function select_determinant(g, n, type = 'defini') {
    if (type === 'defini') {
        if (n === 's') return g === 'm' ? 'le ' : 'la ';
        return 'les ';
    }
    if (type === 'indefini') {
        if (n === 's') return g === 'm' ? 'un ' : 'une ';
        return 'des ';
    }
    return '';
}

function _apply_determinant_and_elision(gn_bare, g, n, type) {
    let det = select_determinant(g, n, type);
    const first = gn_bare ? gn_bare.split(" ")[0] : "";
    if ((det.trim() === 'le' || det.trim() === 'la') && first && _starts_with_vowel(first)) {
        det = "l'";
    }
    return (det + gn_bare).strip();
}

String.prototype.strip = function() { return this.trim(); };

function get_random_adjective_form_from_category(g, n) {
    if (g === 'm' && n === 's') return choice(ADJ_MS);
    if (g === 'f' && n === 's') return choice(ADJ_FS);
    if (g === 'm' && n === 'p') return choice(ADJ_MP);
    if (g === 'f' && n === 'p') return choice(ADJ_FP);
    return "";
}

function formatter_sp_gn_fixed(preposition, gn_info) {
    const gn_str_bare = gn_info.v_bare;
    const gn_g = gn_info.g;
    const gn_n = gn_info.n;
    const starts = _starts_with_vowel(gn_str_bare);

    const p_raw = (preposition || "").trim();
    const p = p_raw.toLowerCase();

    if (p === "au moyen de") {
        if (starts && gn_n === "s") return `au moyen de l'${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "m") return `au moyen du ${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "f") return `au moyen de la ${gn_str_bare}`;
        return `au moyen des ${gn_str_bare}`;
    }

    if (p === "grâce à") {
        if (starts) return `grâce à l'${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "m") return `grâce au ${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "f") return `grâce à la ${gn_str_bare}`;
        return `grâce aux ${gn_str_bare}`;
    }

    if (p === "de") {
        if (starts && gn_n === "s") return `de l'${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "m") return `du ${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "f") return `de la ${gn_str_bare}`;
        return `des ${gn_str_bare}`;
    }

    if (p === "à") {
        if (starts) return `à l'${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "m") return `au ${gn_str_bare}`;
        if (gn_n === "s" && gn_g === "f") return `à la ${gn_str_bare}`;
        return `aux ${gn_str_bare}`;
    }

    const full_gn = _apply_determinant_and_elision(gn_str_bare, gn_g, gn_n, 'defini');
    return eliminer_article_devant_voyelle(`${p_raw} ${full_gn}`);
}

function construire_sp_locatif() {
    const prepo = choice(["dans", "sur", "par", "via"]);
    const gn_base = choice(Object.keys(GN_BASE_MAP).filter(b => GN_BASE_MAP[b].n === 's'));
    const gn_info = get_gn_info(gn_base, 'defini', 's', null, 'complement');
    return formatter_sp_gn_fixed(prepo, gn_info);
}

function construire_sp_moyen() {
    const prepo = choice(["au moyen de", "grâce à", "via", "par"]);
    const gn_base = choice(Object.keys(GN_BASE_MAP).filter(b => GN_BASE_MAP[b].n === 's'));
    const gn_info = get_gn_info(gn_base, 'defini', 's', null, 'complement');
    return formatter_sp_gn_fixed(prepo, gn_info);
}

function construire_sp() {
    const ch = Math.random();
    if (ch < 0.40) return construire_sp_locatif();
    if (ch < 0.85) return construire_sp_moyen();
    const gn = get_gn_info(GNIndefini, 'indefini', null, null, "complement");
    return `comme ${gn.v}`;
}

// =============================================================================
// GÉNÉRATION GN
// =============================================================================

let LAST_GN_INFO = null;

function generer_ps_relative(gn_antecedent_info) {
    const ant_n = gn_antecedent_info.n;
    const ant_g = gn_antecedent_info.g;

    const ant_surface = (gn_antecedent_info.v_bare || gn_antecedent_info.v || "").trim().toLowerCase();
    const ant_is_pron = gn_antecedent_info.is_pronoun || ["nous", "on", "il", "elle", "ils", "elles"].includes(ant_surface);
    const sujet_v_for_person = ant_is_pron ? ant_surface : null;

    if (Math.random() < 0.65) {
        const verbe = conjuguer_verbe(GVTransitif, ant_n, ant_g, null, 'active', sujet_v_for_person);
        const obj = get_gn_info(GNIndefini, 'indefini', null, null, 'object');
        return `qui ${verbe} ${obj.v}`;
    }

    const sujet2 = get_gn_info(GNDefini, 'defini', choice(['s', 'p']), null, 'subject');
    const verbe = conjuguer_verbe(GVTransitif, sujet2.n, sujet2.g, null, 'active', (sujet2.is_pronoun ? sujet2.v : null));
    return `que ${sujet2.v} ${verbe}`;
}

function construire_ps_initiale_clause() {
    const clause_type = choice(['causale', 'temporelle', 'gerondif', 'detache']);
    const sujet_nom = get_gn_info(GNDefini, 'defini', null, null, 'subject');
    const verbe = conjuguer_verbe(GVTransitif, sujet_nom.n, sujet_nom.g, null, 'active', (sujet_nom.is_pronoun ? sujet_nom.v : null));
    const objet = get_gn_info(GNIndefini, 'indefini', null, null, 'object');

    if (clause_type === 'causale') {
        return `${choice(['parce que', 'puisque', 'comme'])} ${sujet_nom.v} ${verbe} ${objet.v}`;
    }
    if (clause_type === 'temporelle') {
        return `${choice(['lorsque', 'quand', 'dès que', 'alors que'])} ${sujet_nom.v} ${verbe} ${objet.v}`;
    }
    if (clause_type === 'gerondif') return choice(Gerondif);
    return choice(AdjDetache);
}

function generer_ps_finale_simple() {
    if (Math.random() < 0.7) {
        const prefixe = choice(["afin de", "pour"]);
        const infinitive = choice(GVInfinitifTransitif);
        const objet = get_gn_info(GNDefini, 'defini', null, null, 'object');
        if (prefixe === "afin de") {
            if (_starts_with_vowel(infinitive)) return `afin d'${infinitive} ${objet.v}`.trim();
            return `afin de ${infinitive} ${objet.v}`.trim();
        }
        return `pour ${infinitive} ${objet.v}`.trim();
    }

    const prefixe = choice(["pour que", "afin que"]);
    const sujet_sub = get_gn_info(GNDefini, 'defini', null, null, 'subject');
    const verbe = conjuguer_verbe(GVTransitif, sujet_sub.n, sujet_sub.g, null, 'active', (sujet_sub.is_pronoun ? sujet_sub.v : null));
    const objet = get_gn_info(GNIndefini, 'indefini', null, null, 'object');
    return `${prefixe} ${sujet_sub.v} ${verbe} ${objet.v}`;
}

function construire_ps_finale() {
    return generer_ps_finale_simple();
}

function construire_attribut_correct(sujet_info, _verbe_key = null) {
    const attribut_type = choice(['adj', 'gn']);
    const n_cible = sujet_info.n;
    const g_cible = sujet_info.g;

    if (attribut_type === 'adj') {
        const base = choice(ADJECTIFS_DISPONIBLES);
        return accorder_attribut(base, g_cible, n_cible);
    }
    const gn_base = choice(Object.keys(GN_BASE_MAP).filter(gn => GN_BASE_MAP[gn].n === n_cible));
    const gn_attr = get_gn_info(gn_base, 'indefini', n_cible);
    return gn_attr.v;
}

function construire_opposition(sujet_info) {
    const adj_base = choice(ADJECTIFS_DISPONIBLES);
    const adj_acc = accorder_attribut(adj_base, sujet_info.g, sujet_info.n);
    const sujet_v = sujet_info.is_pronoun ? sujet_info.v : null;
    const verbe_etre = conjuguer_verbe(GVAttributif, sujet_info.n, "m", 'être', 'active', sujet_v);
    const neg = (verbe_etre && _starts_with_vowel(verbe_etre)) ? "n'" : "ne ";
    return `mais ${neg}${verbe_etre} pas ${adj_acc}`;
}

function generer_gn_recursif_fixed(base_gn_str, type, profondeur = 0, allow_recursion = true) {
    const gn_info_base = _get_base_gn_info(base_gn_str);
    const g = gn_info_base.g;
    const n = gn_info_base.n;

    let adjs_post = [];
    if (Math.random() < 0.40) {
        const adj = get_random_adjective_form_from_category(g, n);
        if (adj) adjs_post.push(adj);
    }

    let gn_final_bare = `${base_gn_str} ${adjs_post.join(' ')}`.trim();

    if (allow_recursion && profondeur < MAX_PROFONDEUR_RECURSIVITE_CN) {
        if (Math.random() < 0.30) {
            const cn_base = choice(GNDefini);
            const cn_rec = generer_gn_recursif_fixed(cn_base, 'defini', profondeur + 1);
            const cn_final = formatter_sp_gn_fixed("de", cn_rec);
            gn_final_bare = `${gn_final_bare} ${cn_final}`.trim();
        }

        if (Math.random() < 0.22) {
            const ant = {
                'v': _apply_determinant_and_elision(gn_final_bare, g, n, "defini"),
                'g': g, 'n': n, 'v_bare': gn_final_bare,
                'is_pronoun': false
            };
            const relative = generer_ps_relative(ant);
            gn_final_bare = `${gn_final_bare} ${relative}`.trim();
        }
    }

    const full = (type === "aucun") 
        ? gn_final_bare 
        : _apply_determinant_and_elision(gn_final_bare, g, n, type);
    
    return { "v": full.trim(), "g": g, "n": n, "v_bare": gn_final_bare.trim() };
}

function generer_gn_coordonne(liste_gn_bases, coord = 'et') {
    const n_choice = choice(['s', 'p']);
    let candidates = liste_gn_bases.filter(b => (GN_BASE_MAP[b] || {}).n === n_choice);
    if (candidates.length < 2) candidates = [...liste_gn_bases];

    const [base1, base2] = sample(candidates, 2);
    const gn1 = generer_gn_recursif_fixed(base1, 'defini', 0);
    const gn2 = generer_gn_recursif_fixed(base2, 'defini', 0);

    const g = (gn1.g === 'm' || gn2.g === 'm') ? 'm' : 'f';
    const v = `${gn1.v} ${coord} ${gn2.v}`;
    const v_bare = `${gn1.v_bare} ${coord} ${gn2.v_bare}`;
    return { "v": v, "v_bare": v_bare, "g": g, "n": "p", "coord": true };
}

function _apply_possessive_determiner(gn_info) {
    const v = gn_info.v || "";
    if (!v) return gn_info;
    if (gn_info.is_pronoun) return gn_info;

    const m = v.match(/^(l'|le|la|les|un|une|des)\s+(.*)$/i);
    if (!m) return gn_info;

    // const det_orig = m[1];
    const reste = m[2];
    const g = gn_info.g || "m";
    const n = gn_info.n || "s";

    let first_bare = "";
    if (gn_info.v_bare) {
        first_bare = gn_info.v_bare.split(" ")[0];
    } else {
        first_bare = reste ? reste.split(" ")[0] : "";
    }

    let det_new;
    if (n === "s") {
        if (g === "m" || _starts_with_vowel(first_bare)) {
            det_new = "mon";
        } else {
            det_new = "ma";
        }
    } else {
        det_new = "mes";
    }

    gn_info.v = `${det_new} ${reste}`.trim();
    return gn_info;
}

function maybe_apply_possessive(gn_info, role, ctx = null) {
    if (!["subject", "object", "complement"].includes(role)) return gn_info;
    if (gn_info.is_pronoun) return gn_info;
    if (Math.random() >= POSSESSIVE_DET_PROB) return gn_info;
    return _apply_possessive_determiner(gn_info);
}

function get_gn_info(gn_list_or_key = null, type = 'defini', n = null, g = null, role = 'subject', ctx = null) {
    // Gestion Pronoms
    if (role === 'subject' && ctx && ctx.person_policy === undefined && LAST_GN_INFO && !LAST_GN_INFO.is_pronoun && Math.random() < 0.13) {
        const pron = _select_pronoun_from_info(LAST_GN_INFO.g, LAST_GN_INFO.n);
        const result = { v: pron, g: LAST_GN_INFO.g, n: LAST_GN_INFO.n, v_bare: pron, is_pronoun: true };
        LAST_GN_INFO = result;
        return result;
    }

    if (role === 'subject' && ctx && ctx.person_policy === "nous") {
        const result = { v: "nous", g: "m", n: "p", v_bare: "nous", is_pronoun: true };
        LAST_GN_INFO = result;
        return result;
    }

    if (role === 'subject' && ctx && ctx.person_policy === "impersonal") {
        const result = { v: "il", g: "m", n: "s", v_bare: "il", is_pronoun: true };
        LAST_GN_INFO = result;
        return result;
    }

    let result;
    if (gn_list_or_key === 'GNPersonnel') {
        let chosen;
        if (ctx && ctx.person_policy === "nous") {
            chosen = { v: "nous", n: "p", g: "m" };
        } else {
            chosen = choice(GNPersonnel);
        }
        result = { v: chosen.v, g: chosen.g, n: chosen.n, v_bare: chosen.v, is_pronoun: true };

    } else if (gn_list_or_key === 'GNImpersonnel') {
        const chosen = choice(GNImpersonnel);
        result = { v: chosen.v, g: chosen.g, n: chosen.n, v_bare: chosen.v, is_pronoun: true };

    } else if (gn_list_or_key === 'Coordination') {
        result = generer_gn_coordonne(GNDefini);

    } else {
        let base;
        if (Array.isArray(gn_list_or_key)) {
            base = choice(gn_list_or_key);
            type = (gn_list_or_key === GNDefini || gn_list_or_key === GNComplexe) ? 'defini' : 'indefini';
        } else {
            base = (GNDefini.includes(gn_list_or_key)) ? gn_list_or_key : choice(GNDefini);
        }

        const info = _get_base_gn_info(base);
        if (n === null) n = info.n;
        if (g === null) g = info.g;
        result = generer_gn_recursif_fixed(base, type, 0);
    }

    result = maybe_apply_possessive(result, role, ctx);

    if (role === 'subject' && !result.is_pronoun && type === 'defini') {
        LAST_GN_INFO = result;
    } else {
        LAST_GN_INFO = null;
    }

    return result;
}

// =============================================================================
// GRAMMAIRE
// =============================================================================

const GRAMMAR = {
    "PHRASE": [
        ["PREFIXE", "PROPOSITION", "SUFFIXE"],
        ["PROPOSITION"],
    ],
    "PREFIXE": [
        [],
        ["PS_INIT"],
        ["ADV_DETACHE"],
    ],
    "SUFFIXE": [
        [],
        ["PS_FINALE"],
        ["OPPOSITION"],
    ],
    "PROPOSITION": [
        ["SUJET", "GV"],
        ["SUJET", "GV", "SUB_EMBED"],
    ],
    "SUB_EMBED": [
        [],
        ["INTRO_SUB", "QUE", "PROPOSITION_SUB"],
    ],
    "PROPOSITION_SUB": [
        ["SUJET_SUB", "GV_SUB"],
        ["SUJET_SUB", "GV_SUB", "SUB_EMBED"],
    ],
    "GV": [
        ["GV_TRANS"],
        ["GV_ATTR"],
        ["GV_INTRANS"],
        ["GV_PASSIF"],
        ["GV_MODAL"],
        ["GV_REFLEXIF"],
    ],
    "GV_SUB": [
        ["GV_TRANS_SUB"],
        ["GV_ATTR_SUB"],
        ["GV_INTRANS_SUB"],
        ["GV_PASSIF_SUB"],
        ["GV_MODAL_SUB"],
        ["GV_REFLEXIF_SUB"],
    ],
    "GV_TRANS": [["VERBE_TRANS", "OBJET", "SP_CHAIN", "REL_OPT"]],
    "GV_ATTR": [["VERBE_ATTR", "ATTRIBUT", "SP_CHAIN"]],
    "GV_INTRANS": [["VERBE_INTRANS", "SP_CHAIN"]],
    "GV_PASSIF": [["VERBE_PASSIF", "AGENT_OPT", "SP_CHAIN"]],
    "GV_MODAL": [["VERBE_MODAL", "INFINITIF_NU", "OBJET_OPT", "SP_CHAIN"]],
    "GV_REFLEXIF": [["VERBE_REFLEXIF", "SP_CHAIN", "PS_FINALE_OPT"]],

    "GV_TRANS_SUB": [["VERBE_TRANS_SUB", "OBJET", "SP_CHAIN", "REL_OPT"]],
    "GV_ATTR_SUB": [["VERBE_ATTR_SUB", "ATTRIBUT_SUB", "SP_CHAIN"]],
    "GV_INTRANS_SUB": [["VERBE_INTRANS_SUB", "SP_CHAIN"]],
    "GV_PASSIF_SUB": [["VERBE_PASSIF_SUB", "AGENT_OPT", "SP_CHAIN"]],
    "GV_MODAL_SUB": [["VERBE_MODAL_SUB", "INFINITIF_NU", "OBJET_OPT", "SP_CHAIN"]],
    "GV_REFLEXIF_SUB": [["VERBE_REFLEXIF_SUB", "SP_CHAIN", "PS_FINALE_OPT"]],

    "OBJET_OPT": [[], ["OBJET"]],
    "SP_CHAIN": [[], ["SP", "SP_CHAIN"]],
    "REL_OPT": [[], ["RELATIVE"]],
    "AGENT_OPT": [[], ["SP_AGENT"]],
    "PS_FINALE_OPT": [[], ["PS_FINALE"]],
    "QUE": [["que"]],
};

// =============================================================================
// RÉALISATION / EXPANSION
// =============================================================================

function realize(symbol, ctx) {
    if (symbol === "PS_INIT") return construire_ps_initiale_clause();
    if (symbol === "ADV_DETACHE") return choice([...AdjDetache, ...Gerondif, ...AdvConnecteur, ...Coordination]);
    if (symbol === "PS_FINALE") return construire_ps_finale();

    if (symbol === "INTRO_SUB") {
        const s = ctx.sujet;
        const sujet_v = s.is_pronoun ? s.v : null;
        const v = conjuguer_verbe(GVIntroductif, s.n, s.g, choice(["affirmer", "montrer", "démontrer", "suggérer"]), 'active', sujet_v);
        return "et " + v;
    }

    if (symbol === "SUJET") {
        if (ctx.person_policy === undefined || ctx.person_policy === null) {
            const r = Math.random();
            if (r < 0.10) ctx.person_policy = "impersonal";
            else if (r < 0.22) ctx.person_policy = "nous";
            else ctx.person_policy = null;
        }

        const pick = Math.random();
        let s;
        if (ctx.person_policy === "nous") {
            s = get_gn_info(null, 'defini', null, null, "subject", ctx);
        } else if (ctx.person_policy === "impersonal") {
            s = get_gn_info("GNImpersonnel", 'defini', null, null, "subject", ctx);
        } else {
            if (pick < 0.10) s = get_gn_info("GNImpersonnel", 'defini', null, null, "subject", ctx);
            else if (pick < 0.24) s = get_gn_info("GNPersonnel", 'defini', null, null, "subject", ctx);
            else if (pick < 0.38) s = get_gn_info("Coordination", 'defini', null, null, "subject", ctx);
            else s = get_gn_info(GNDefini, 'defini', choice(['s', 'p']), null, "subject", ctx);
        }

        ctx.sujet = s;
        return s.v;
    }

    if (symbol === "SUJET_SUB") {
        let s = get_gn_info(GNDefini, 'defini', choice(['s', 'p']), null, 'subject', ctx);
        if (ctx.person_policy === "nous" && ["il", "on"].includes(s.v)) {
            s = get_gn_info(GNDefini, 'defini', choice(['s', 'p']), null, 'subject', ctx);
        }
        ctx.sujet_sub = s;
        return s.v;
    }

    if (symbol === "OBJET") {
        return (Math.random() < 0.7 
            ? get_gn_info(GNIndefini, 'indefini', null, null, 'object', ctx)
            : get_gn_info(GNDefini, 'defini', null, null, 'object', ctx)).v;
    }

    if (symbol === "VERBE_TRANS") {
        const s = ctx.sujet;
        return conjuguer_verbe(GVTransitif, s.n, s.g, null, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_ATTR") {
        const s = ctx.sujet;
        const key = choice(Object.keys(GVAttributif));
        ctx.verbe_attr = key;
        return conjuguer_verbe(GVAttributif, s.n, "m", key, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_INTRANS") {
        const s = ctx.sujet;
        return conjuguer_verbe(GVIntransitif, s.n, s.g, null, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_PASSIF") {
        const s = ctx.sujet;
        const key = choice(Object.keys(VERBES_PASSIFS));
        return conjuguer_verbe(GVPassif, s.n, s.g, key, "passive", (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_MODAL") {
        const s = ctx.sujet;
        const key = choice(["devoir", "pouvoir"]);
        ctx.modal_key = key;
        return conjuguer_verbe(GVModalPersonal, s.n, s.g, key, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_REFLEXIF") {
        const s = ctx.sujet;
        const key = choice(Object.keys(GVReflexifAttributif));
        return conjuguer_verbe(GVReflexifAttributif, s.n, "m", key, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "ATTRIBUT") {
        return construire_attribut_correct(ctx.sujet, ctx.verbe_attr);
    }

    // Subordonnées
    if (symbol === "VERBE_TRANS_SUB") {
        const s = ctx.sujet_sub;
        return conjuguer_verbe(GVTransitif, s.n, s.g, null, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_ATTR_SUB") {
        const s = ctx.sujet_sub;
        const key = choice(Object.keys(GVAttributif));
        ctx.verbe_attr_sub = key;
        return conjuguer_verbe(GVAttributif, s.n, "m", key, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_INTRANS_SUB") {
        const s = ctx.sujet_sub;
        return conjuguer_verbe(GVIntransitif, s.n, s.g, null, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_PASSIF_SUB") {
        const s = ctx.sujet_sub;
        const key = choice(Object.keys(VERBES_PASSIFS));
        return conjuguer_verbe(GVPassif, s.n, s.g, key, "passive", (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_MODAL_SUB") {
        const s = ctx.sujet_sub;
        const key = choice(["devoir", "pouvoir"]);
        return conjuguer_verbe(GVModalPersonal, s.n, s.g, key, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "VERBE_REFLEXIF_SUB") {
        const s = ctx.sujet_sub;
        const key = choice(Object.keys(GVReflexifAttributif));
        return conjuguer_verbe(GVReflexifAttributif, s.n, "m", key, 'active', (s.is_pronoun ? s.v : null));
    }
    if (symbol === "ATTRIBUT_SUB") {
        return construire_attribut_correct(ctx.sujet_sub, ctx.verbe_attr_sub);
    }

    if (symbol === "SP_AGENT") {
        const agent = get_gn_info(GNIndefini, 'indefini', null, null, 'complement', ctx);
        return formatter_sp_gn_fixed("par", agent);
    }
    if (symbol === "INFINITIF_NU") {
        return choice(GVInfinitifTransitif);
    }
    if (symbol === "SP") {
        return construire_sp();
    }
    if (symbol === "RELATIVE") {
        return generer_ps_relative(ctx.sujet);
    }
    if (symbol === "OPPOSITION") {
        return construire_opposition(ctx.sujet);
    }
    if (symbol === "QUE" || symbol === "que") {
        return "que";
    }

    return "";
}

function expand(symbol, ctx, depth = 0, sub_depth = 0) {
    if (depth > MAX_EXPANSION_DEPTH) return "";

    if (!GRAMMAR[symbol]) {
        return realize(symbol, ctx);
    }

    if (["SUB_EMBED", "PROPOSITION_SUB"].includes(symbol) && sub_depth >= MAX_PROFONDEUR_RECURSIVITE_SUB) {
        return "";
    }

    const rule = choice(GRAMMAR[symbol]);
    if (!rule || rule.length === 0) return "";

    const parts = [];
    for (const sym of rule) {
        let next_sub_depth = sub_depth;
        if (["SUB_EMBED", "PROPOSITION_SUB"].includes(sym)) {
            next_sub_depth = sub_depth + 1;
        }
        const chunk = expand(sym, ctx, depth + 1, next_sub_depth);
        if (chunk) parts.push(chunk);
    }

    return parts.join(" ").trim();
}

// =============================================================================
// POST-TRAITEMENT
// =============================================================================

const _WORD = "[a-zàâçéèêëîïôûùüÿœ\\-]+";
const _PHRASE_N = `${_WORD}(?:\\s+${_WORD}){0,4}`;

function _collapse_repeated_prep_phrases(txt) {
    // Note: JS Regex backreferences are \1, \2 etc within the regex, $1, $2 in replacement
    const patterns = [
        new RegExp(`\\b(du)\\s+(${_PHRASE_N})\\s+\\1\\s+\\2\\b`, "gi"),
        new RegExp(`\\b(des)\\s+(${_PHRASE_N})\\s+\\1\\s+\\2\\b`, "gi"),
        new RegExp(`\\b(de la)\\s+(${_PHRASE_N})\\s+\\1\\s+\\2\\b`, "gi"),
        new RegExp(`\\b(de l')\\s*(${_PHRASE_N})\\s+\\1\\s*\\2\\b`, "gi"),
        new RegExp(`\\b(au)\\s+(${_PHRASE_N})\\s+\\1\\s+\\2\\b`, "gi"),
        new RegExp(`\\b(aux)\\s+(${_PHRASE_N})\\s+\\1\\s+\\2\\b`, "gi"),
        new RegExp(`\\b(à la)\\s+(${_PHRASE_N})\\s+\\1\\s+\\2\\b`, "gi"),
        new RegExp(`\\b(à l')\\s*(${_PHRASE_N})\\s+\\1\\s*\\2\\b`, "gi"),
        new RegExp(`\\b(d')\\s*(${_PHRASE_N})\\s+\\1\\s*\\2\\b`, "gi"),
    ];

    let prev = null;
    let cur = txt;

    for (let i = 0; i < 3; i++) {
        prev = cur;
        for (const pat of patterns) {
            cur = cur.replace(pat, "$1 $2");
        }
        cur = cur.replace(/\s+/g, " ").trim();
        if (cur === prev) break;
    }
    return cur;
}

function post_process_phrase(phrase) {
    phrase = phrase.replace(/\s+/g, ' ').trim();
    phrase = phrase.replace(/\s([,.:;?!])/g, '$1');

    phrase = eliminer_article_devant_voyelle(phrase);

    phrase = phrase.replace(/\b([dlmnstcquj]')\s+/gi, "$1");
    phrase = phrase.replace(/\bde\s+le\b/gi, "du");
    phrase = phrase.replace(/\bde\s+les\b/gi, "des");
    phrase = phrase.replace(/\bà\s+le\b/gi, "au");
    phrase = phrase.replace(/\bà\s+les\b/gi, "aux");

    phrase = phrase.replace(/\b(et)\s+(affirme|suggère|montre|démontre)\s*,\s*que\b/gi, "$1 $2 que");

    phrase = phrase.replace(/\b(doit|peut|devons|pouvons|doivent|peuvent)\s+\1\b/gi, "$1");
    phrase = phrase.replace(/\b(\w+)\s+\1\b/gi, "$1");

    // Patch anti-bégaiement
    phrase = _collapse_repeated_prep_phrases(phrase);

    phrase = phrase.trim().replace(/,+$/, "");
    if (phrase && !['.', '?', '!', ':'].some(p => phrase.endsWith(p))) {
        phrase += '.';
    }
    if (phrase && /^[a-zàâçéèêëîïôûùüÿœ]/i.test(phrase)) {
        phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
    return phrase;
}

// =============================================================================
// VALIDATION ANTI-COUPURE
// =============================================================================

function _finite_verb_forms_set() {
    const forms = new Set();
    [GVTransitif, GVAttributif, GVIntransitif, GVModalPersonal, GVReflexifAttributif].forEach(dict => {
        Object.values(dict).forEach(m => {
            if (m.s) forms.add(m.s);
            if (m.p) forms.add(m.p);
        });
    });
    Object.values(GV_PERSONNEL_NOUS_EXPLICIT).forEach(f => forms.add(f));
    forms.add("est");
    forms.add("sont");
    return forms;
}

const FINITE_FORMS = _finite_verb_forms_set();

function _looks_like_fragment(s) {
    s = (s || "").trim();
    if (!s) return true;

    // "Nous." / "Il." / "On."
    if (/^(nous|il|on)\.?$/i.test(s)) return true;

    // Trop court, sans verbe visible
    const tokens = s.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ']+/g) || [];
    if (tokens.length < 3) return true;

    // Doit contenir au moins un verbe fini connu
    const has_finite = tokens.some(tok => FINITE_FORMS.has(tok));
    if (!has_finite) return true;

    // Empêche "Il via ..."
    if (/^(il|nous|on)\s+(via|par|dans|sur|au)\b/i.test(s)) return true;

    return false;
}

// =============================================================================
// GÉNÉRATION PRINCIPALE
// =============================================================================

function generate_sentence() {
    for (let i = 0; i < MAX_RETRY_SENTENCE; i++) {
        LAST_GN_INFO = null;
        const ctx = { person_policy: null };
        const raw = expand("PHRASE", ctx);
        const s = post_process_phrase(raw);

        if (_looks_like_fragment(s)) continue;

        return s;
    }
    return "Nous formulons une hypothèse.";
}

function generate_prose_block(n = NOMBRE_DE_PHRASES_SOUHAITE) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const s = generate_sentence();
        if (s) out.push(s);
    }
    return out.join(" ");
}

// Exécution si lancé directement
if (typeof require !== 'undefined' && require.main === module) {
    console.log(generate_prose_block());
} else {
    // Si dans un navigateur ou importé
    console.log(generate_prose_block());
}
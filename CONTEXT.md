# Kitchen

Application familiale de gestion de stock cuisine et d'assistance à la génération de recettes, organisée par foyer (household) multi-utilisateurs.

## Language

**Household**:
Le foyer : unité d'isolation des données (stock, modes de cuisson, préférences, membres). Toute donnée métier appartient à exactement un household.
_Avoid_: Compte, famille, groupe

**Ingredient**:
Un ingrédient de stock, propre à un household, avec un état de présence (présent/absent) et un rangement (frigo/placard/congélateur).
_Avoid_: Item, produit, denrée

**Cooking mode** (mode de cuisson):
Un équipement de cuisson disponible dans un household (ex. casserole, four, air fryer), avec un état de présence au même gabarit qu'un Ingredient mais sans rangement — entité distincte d'Ingredient car son cycle de vie diffère (valeurs par défaut à la création du household).
_Avoid_: Équipement, appareil, ustensile

**Household preferences**:
Le texte libre unique par household (allergies, régime, goûts récurrents) pris en compte à chaque génération de recette. Un seul par household, jamais par utilisateur.
_Avoid_: Profil, réglages

**Invitation**:
Le lien à durée de vie courte permettant à une personne de rejoindre un household existant en créant son propre compte (user + passkey). Une seule invitation active par household à la fois : en générer une nouvelle révoque implicitement la précédente. Distincte d'un Device link token (qui rattache un nouvel appareil à un user déjà existant, jamais à un nouveau household).
_Avoid_: Code d'accès, token d'inscription

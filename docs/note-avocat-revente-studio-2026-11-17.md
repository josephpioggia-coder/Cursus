# Cursus — Revente de places par les clients « Studio » : questions pour avis juridique

*Note du 17/11/2026, à l'attention de mon avocat. Document de travail : le modèle n'est pas encore en service et rien n'est construit.*

## 1. Le produit
Cursus est un service en ligne (abonnement) d'aide à l'écriture et à l'analyse de manuscrits, qui utilise des modèles d'intelligence artificielle de prestataires tiers (Anthropic, OpenAI). Il est édité par une société belge en cours de constitution (structure à confirmer). Prix hors TVA, TVA du pays du client ajoutée à la commande (Stripe Tax, non encore activé).

## 2. Le modèle envisagé
La formule **Studio** coûte **79 €/mois**. Elle comprend 2 utilisateurs et un quota de 1 000 analyses IA par mois, partagé entre eux. Chaque utilisateur supplémentaire se prend, au choix :
- **+12 €/mois** (+250 analyses), soit la moitié du prix public de la formule équivalente (24,99 €) ;
- **+24 €/mois** (+500 analyses), soit la moitié du prix public de la formule équivalente (49 €).

Le titulaire du compte Studio pourrait **revendre ces places à ses propres clients au prix qu'il fixe**. Il garderait la différence : de 0 (s'il revend au prix payé) à environ 50 % du prix public. Il paie Cursus ; ses clients le paient lui. Cursus ne facturerait pas les clients finaux.

## 3. Ce qui est déjà en place, et ce qui ne l'est pas
Il existe des CGV, des mentions légales et une politique de confidentialité (à valider), une souscription par Stripe Checkout, et l'annulation en libre-service. **Il n'existe aucun contrat de revente, aucun sous-compte, aucun prix Stripe pour ces places.** Aujourd'hui, ce modèle ne vit qu'en texte sur la carte tarifaire.

## 4. Questions
**Contrat et qualification**
1. Comment qualifier la relation (revendeur, apporteur d'affaires, licence d'utilisation) et quel contrat-type prévoir ?
2. Qui est le cocontractant du client final, et quelles CGV le lient ? Le revendeur vend-il à des consommateurs (droit de rétractation, information précontractuelle) ? Qui en porte la responsabilité ?
3. Puis-je imposer un nombre minimal de places, ou seulement recommander un prix de revente ? Quelles limites au regard du droit de la concurrence ?
4. Résiliation, suspension pour abus, sort des clients finaux et de leurs données si le revendeur cesse.

**Données personnelles (RGPD)**
5. Qui est responsable du traitement et qui est sous-traitant pour les textes des clients finaux ? Un accord de sous-traitance est-il nécessaire ?
6. Faut-il lister les prestataires d'IA comme sous-traitants ultérieurs, et informer les clients finaux ? Que dire sur l'absence d'entraînement des modèles avec leurs textes ?

**TVA et facturation**
7. Facturation de Cursus au revendeur (B2B, autoliquidation hors Belgique ?) et du revendeur à ses clients : quelles mentions, quel rôle de Stripe Tax, et quid du guichet unique (OSS) ?

**Compléments (convention v1.1)**
10. Plafond de responsabilité (art. 12.4) : douze mois de paiements du Partenaire ; faut-il un montant plancher ?
11. Préavis de 30 jours pour ne pas renouveler un abonnement annuel : valable envers des consommateurs (bouton d'annulation appliqué à tous les abonnés annuels) ? Texte actuel des CGV, art. 6.

**Responsabilité**
8. Limitation de responsabilité (erreurs de l'IA, perte de données, indisponibilité) et partage du support entre Cursus et le revendeur.
9. Usage de la marque Cursus par le revendeur (marque blanche ou non).

## 5. Ce que je demande
Un avis sur la faisabilité, les clauses essentielles d'un contrat de revente, et ce qu'il faut modifier dans les CGV et la politique de confidentialité avant tout lancement.

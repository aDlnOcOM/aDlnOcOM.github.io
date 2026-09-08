# Equipment workshop

The shelter opens an independent modal workshop from the equipment button or any
loadout card. Seven item profiles use separate accents, emblems and silhouettes.
The SMG has six branches; each other item has three. Every branch offers two
exclusive specializations followed by an upgrade that requires its parent.
There are 96 purchasable nodes overall, including 48 new upgrades.

Progress retains the existing save key and branch identifiers. New branches are
initialized without resetting old purchases. Additional bonuses are composed with
existing player statistics when a run starts. No new runtime dependencies.

## Automated checks

Run `node --test equipment.test.cjs` and syntax-check `equipment.js` / `script.js`.
Tests use isolated in-memory saves, not browser storage. They exercise catalogue
coverage, legacy saves, all branch purchase prerequisites, exclusivity, duplicate
purchases, insufficient funds, save round trips and every new stat bonus.

## Manual browser acceptance (not yet verified)

Browser automation was blocked by the local-file URL security policy. Verify:

1. Open each of the seven items from the shelter and from the modal sidebar.
2. Inspect future nodes, their parent labels, effects and unavailable actions.
3. With earned salvage, buy a specialization then its descendant; verify the
   competing path locks, the wallet updates and the viewport does not jump.
4. Reload the page and confirm bought nodes remain installed.
5. Test zoom controls, horizontal/vertical scrolling and a narrow viewport.
6. Tab through the modal; arrows should scroll instead of controlling the game.
   Escape and the close button should return focus outside the closed modal.
7. Start a run and check the changed equipment statistics in actual combat.

Existing SMG descriptions and effects were preserved, not rebalanced by this work.

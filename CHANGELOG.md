# 1.0.0 (2026-01-28)


### Bug Fixes

* correct timer method name and update exports and progress tracking ([a2076cb](https://github.com/WiegerWolf/baritone-ts/commit/a2076cbaad448202678bf10a268c6b35ca6ef8a3))


### Code Refactoring

* **tasks:** consolidate portal task implementations ([eff1b34](https://github.com/WiegerWolf/baritone-ts/commit/eff1b3417d1213a57b0afc2214858d66800a0d2a))


### Documentation

* update documentation for goal, movement, and task system changes ([ddb2bd7](https://github.com/WiegerWolf/baritone-ts/commit/ddb2bd73b172231e7ca1ff44c4a6a6e063426c47))


### Features

* add 12 new composite tasks and improve type safety ([4191ad9](https://github.com/WiegerWolf/baritone-ts/commit/4191ad96ac318e9bd189e8b6057a2c6062699903))
* Add advanced construction tasks (Iteration 12) ([16de7f5](https://github.com/WiegerWolf/baritone-ts/commit/16de7f519a389a15b2bdc5585d7b7c7ea19b6e3e))
* Add AltoClef/BaritonePlus core infrastructure ([2395602](https://github.com/WiegerWolf/baritone-ts/commit/2395602c05461606a7c7c1428cf950c064aea948))
* Add BeatMinecraftTask speedrun orchestrator (Iteration 13) ([f2a9ca4](https://github.com/WiegerWolf/baritone-ts/commit/f2a9ca4621ad1cce36e99821b975ccbe1df4e20e))
* add behavior process system, chunk cache, and input/rotation helpers ([0e4d6b7](https://github.com/WiegerWolf/baritone-ts/commit/0e4d6b71a425d24d148591886aaaae0f41420c37))
* add benchmark and debug/visualization utilities ([77070ce](https://github.com/WiegerWolf/baritone-ts/commit/77070cebfea30e46666ee559fa1e1ec38396a2e4))
* add build process and break-while-walking path optimization ([47d9f37](https://github.com/WiegerWolf/baritone-ts/commit/47d9f37082bc7530de113ce00a4899442cdec392))
* Add CarveThenCollect, Hero, and PlaceObsidianBucket tasks (Iteration 14) ([2d45624](https://github.com/WiegerWolf/baritone-ts/commit/2d456248aac0011efa8545addd4c1f59112406e0))
* add chunk cache disk persistence, swimming, and door movement support ([75704ab](https://github.com/WiegerWolf/baritone-ts/commit/75704ab271195991b5ea8a16877778000793e4d4))
* add chunk loading helper and enhance movement system ([d6b04db](https://github.com/WiegerWolf/baritone-ts/commit/d6b04dbcca9498c05c48c0ebdf5957d989fbd7d2))
* add combat process and path smoother ([84833c5](https://github.com/WiegerWolf/baritone-ts/commit/84833c5bbce976e63f21d67f44bfef816f4ba977))
* Add CombatTask and SurviveTask for automated gameplay ([7d820c8](https://github.com/WiegerWolf/baritone-ts/commit/7d820c8799ad01a9c1d5b589e4112c7d0a10ea07)), closes [Hi#level](https://github.com/Hi/issues/level)
* Add composite tasks for wood collection and tool acquisition ([336aa17](https://github.com/WiegerWolf/baritone-ts/commit/336aa17ee8fa91712d7c7dd2ad622753b55310d7))
* Add concrete task implementations for navigation, mining, placement, crafting ([5b7456a](https://github.com/WiegerWolf/baritone-ts/commit/5b7456a74d59c77a4bcba293e1bdd969e4e6e548))
* Add control system and utility helpers ([fbcd15f](https://github.com/WiegerWolf/baritone-ts/commit/fbcd15f5773733490f6fdeb5191657a11790380f))
* Add CraftingRecipe system and TaskCatalogue ([6ac9434](https://github.com/WiegerWolf/baritone-ts/commit/6ac9434d7dbdadea5d3bfac0b11f3e55471d4a8b))
* add DeathMenuChain and PlayerInteractionFixChain ([f5d21d0](https://github.com/WiegerWolf/baritone-ts/commit/f5d21d0cc32ae0b91eef55cf2ab80717c4d59230))
* add elytra flight and boat travel movement systems ([cab313d](https://github.com/WiegerWolf/baritone-ts/commit/cab313dbeddf9168572011ec693682014a94f344))
* add ender pearl throwing task and blacklisting system ([9d56e32](https://github.com/WiegerWolf/baritone-ts/commit/9d56e327493aedd814c2325d7a30a372899a87a9))
* add enhanced slot tasks for item movement ([0c18177](https://github.com/WiegerWolf/baritone-ts/commit/0c181779c6de2e9d0d7c55ec453e339d749ced30))
* Add entity, mining requirement, and projectile helper utilities ([086d811](https://github.com/WiegerWolf/baritone-ts/commit/086d8113a4c86179f1f8e5859582ae09b6d6f2e1))
* Add ExploreTask and BuildShelterTask composite tasks ([8bcb9db](https://github.com/WiegerWolf/baritone-ts/commit/8bcb9dbf6f95672237b21880b6aec698c39a46b7))
* add farm process and ladder/vine climbing movements ([7e5d917](https://github.com/WiegerWolf/baritone-ts/commit/7e5d917daab0ac8f70c2459bc4eb724de2dbc95c))
* Add GatherResourcesTask for flexible multi-item gathering ([0b558f1](https://github.com/WiegerWolf/baritone-ts/commit/0b558f1f730f7f12d0e807b88cb20d667ca7f3d6))
* add GetToXZWithElytraTask and update Progress.md ([4d592d2](https://github.com/WiegerWolf/baritone-ts/commit/4d592d2719ef77f6aed95eab279b55bbbbd21c6d))
* add GoalDodgeProjectiles, ShearSheepTask, RepairToolTask, and trackers ([b26043b](https://github.com/WiegerWolf/baritone-ts/commit/b26043b35a8e9aece0c858da9bc9cd481e892738))
* add ITaskUsesCraftingGrid interface and BotBehaviour system ([5f0ef3c](https://github.com/WiegerWolf/baritone-ts/commit/5f0ef3cf5a3a9a015be0661b0ea8fe043f41c6e2))
* add item gathering, swimming, and door movement systems ([83cf9de](https://github.com/WiegerWolf/baritone-ts/commit/83cf9de7e42fc33aea51114be940c7dff35ae85d))
* Add ItemStorageTracker, StorageHelper, and EventBus ([12eb0ee](https://github.com/WiegerWolf/baritone-ts/commit/12eb0eea52d644dbd4fce076e656457e38ab8fbc))
* Add MineOresTask and FarmTask composite tasks ([81328e2](https://github.com/WiegerWolf/baritone-ts/commit/81328e2a14e744fb707096b393b4935cb23f908e))
* Add movement and resource collection tasks (Iteration 8) ([a4ad1c3](https://github.com/WiegerWolf/baritone-ts/commit/a4ad1c304c246f9af5fc38a67c719293e1787e8f))
* add MovementParkourAscend for long jump with upward movement ([33bb9c1](https://github.com/WiegerWolf/baritone-ts/commit/33bb9c1d81e23bebf69d1ef24219378f188c5ed6))
* Add obsidian, portal construction, and temple looting tasks (Iteration 9) ([8eb1026](https://github.com/WiegerWolf/baritone-ts/commit/8eb10268b914a82cf97369fa322485ab94cd9794))
* Add SlotHandler, ResourceTask, Settings, and LookHelper ([9d3fb2c](https://github.com/WiegerWolf/baritone-ts/commit/9d3fb2cf4635375e2f5da4e25c2337df34212938))
* Add smelting, inventory, and interaction tasks ([739107a](https://github.com/WiegerWolf/baritone-ts/commit/739107abc0e6420d74fde5632f42589dc224e27c))
* Add stash management and structure ravaging tasks (Iteration 10) ([52df623](https://github.com/WiegerWolf/baritone-ts/commit/52df62316cd54dbc02f4d8000042e0dd36883007))
* Add storage container, inventory crafting, and enhanced interaction tasks ([9dab819](https://github.com/WiegerWolf/baritone-ts/commit/9dab819a57f6f61225fd15d5baa2b95ac3f969fa))
* Add stronghold location and dragon fight tasks (Iteration 11) ([012c6ad](https://github.com/WiegerWolf/baritone-ts/commit/012c6adb13e918fe5fc4f597c89bc60cca3a9675))
* Add trackers and survival chains ([9b84a01](https://github.com/WiegerWolf/baritone-ts/commit/9b84a012caa45b4a4514bb4f4c5fcc045f724382)), closes [hi#value](https://github.com/hi/issues/value)
* **baritone-ts:** initialize TypeScript port of Minecraft pathfinding library ([07a1aad](https://github.com/WiegerWolf/baritone-ts/commit/07a1aad65ada62f7ee5295878a6445789803fbf5))
* Complete BaritonePlus port with PlaceStructureBlock and AbstractDoToClosestObject (Iteration 15 - Final) ([00fa41e](https://github.com/WiegerWolf/baritone-ts/commit/00fa41ee572f32b0c65c7c762221b9cbf975ff22))
* Complete essential chains and add ItemTarget ([0ccdf28](https://github.com/WiegerWolf/baritone-ts/commit/0ccdf28825a2080526d8e41473d26e847c4328ea))
* **goals:** add 5 new goal types and update progress tracking ([7def49f](https://github.com/WiegerWolf/baritone-ts/commit/7def49f4b074a77f0d5af28b360b7cce78a86622))
* implement slot and movement utility tasks with tests ([ebe3cec](https://github.com/WiegerWolf/baritone-ts/commit/ebe3cece2584bac7c9d1a76e6d1f0bd8780bc589))
* **movements, pathing, core:** add movement fall and block update watcher modules ([1b0311e](https://github.com/WiegerWolf/baritone-ts/commit/1b0311e0df4c35dbf57024761eec4f69931ce779))
* **tasks:** Add container and construction tasks from BaritonePlus ([3605d56](https://github.com/WiegerWolf/baritone-ts/commit/3605d56a7550d2c6f2e2b314db91e3a72404802c))
* **tasks:** Add entity interaction and escape tasks from BaritonePlus ([67f6640](https://github.com/WiegerWolf/baritone-ts/commit/67f66406b42c37d2266fb37818554a2526336c3c))
* **tasks:** add GetToOuterEndIslandsTask and update progress tracking ([c7bb821](https://github.com/WiegerWolf/baritone-ts/commit/c7bb8212ae3d0e0df18625ab10566ef0a370ded2))
* **tasks:** add GetToXZWithElytraTask for elytra flight navigation ([4f54dd2](https://github.com/WiegerWolf/baritone-ts/commit/4f54dd23c1017d21836025ff3879a389618ae4cc))
* **tasks:** add pickup item and flee from entities tasks ([a04f07b](https://github.com/WiegerWolf/baritone-ts/commit/a04f07bbc67f3943def1a0231703314fa37d9841))
* **tasks:** Add portal, armor, bed, liquid collection, and dodge tasks ([098d9ba](https://github.com/WiegerWolf/baritone-ts/commit/098d9baae47960b2bd67960b179606a3dc336a9d))
* **tasks:** Add resource collection and block search tasks from BaritonePlus ([4ee524a](https://github.com/WiegerWolf/baritone-ts/commit/4ee524a44638769722775b5e3ab7908534d39f77))
* **tasks:** Add trade, MLG, and chunk search tasks from BaritonePlus ([ffccbe7](https://github.com/WiegerWolf/baritone-ts/commit/ffccbe7e6edbe680dbe25fe67d1e7d1f7d3db4ee))
* **trackers:** enhance ItemStorageTracker with slot-level inventory queries ([92e7788](https://github.com/WiegerWolf/baritone-ts/commit/92e77888e698760f4466f655ff297a8d58764463))
* **utils:** add ArmorRequirement and MathHelper ([055008b](https://github.com/WiegerWolf/baritone-ts/commit/055008b7824bed921c43df56cfcd8dcab79d965f))
* **utils:** add RecipeTarget and SmeltTarget for crafting and smelting tasks ([e945593](https://github.com/WiegerWolf/baritone-ts/commit/e945593ba1aa1de9f6f7278e4f56ed14c837c851))


### BREAKING CHANGES

* Goal interface changed from isInGoal() to isEnd()
* **tasks:** The concrete/PortalTask.ts file has been deleted. All portal-related tasks are now exported from composite/PortalTask. The enterNether helper is now an alias for enterNetherLegacy for compatibility.
* **trackers:** InventorySubTracker and ContainerSubTracker functionality is now integrated into ItemStorageTracker
* COST_INF is no longer exported from index.ts; use from types directly if needed

# Task Deduplication Plan

This document tracks duplicate tasks between `src/tasks/concrete/` and `src/tasks/composite/` that need consolidation.

## Background

The codebase was ported from two different Java projects:
- **BaritonePlus** → mostly in `concrete/`
- **AltoClef** → mostly in `composite/`

This resulted in duplicate implementations of the same functionality.

---

## Duplicate Pairs

### 1. Shearing Tasks

| File | Source |
|------|--------|
| `concrete/ShearSheepTask.ts` | BaritonePlus |
| `composite/ShearTask.ts` | AltoClef |

#### Comparison

| Aspect | concrete/ShearSheepTask | composite/ShearTask |
|--------|------------------------|---------------------|
| Sheep metadata | ✅ Proper bit checking for sheared status | ❌ Assumes shearable |
| Color detection | ✅ Full color index mapping | ❌ Returns 'white' always |
| Stuck handling | ❌ None | ✅ Approach timeout + stuck timer |
| Movement | ✅ Uses `GoToNearTask` | ❌ Raw `setControlState` |

#### Recommendation
**Merge** - Take metadata/color handling from concrete, timeout handling from composite.

#### Status
- [ ] Create merged implementation
- [ ] Update imports/exports
- [ ] Delete redundant file
- [ ] Update tests

---

### 2. Elytra Tasks

| File | Source |
|------|--------|
| `concrete/GetToXZWithElytraTask.ts` | BaritonePlus |
| `composite/ElytraTask.ts` | AltoClef |

#### Comparison

| Aspect | concrete/GetToXZWithElytraTask | composite/ElytraTask |
|--------|-------------------------------|---------------------|
| Lines | 506 | 424 |
| Emergency landing | ✅ Full tracking with landing point | ❌ None |
| Firework logic | ✅ Collection + minimum thresholds | ❌ Basic |
| Altitude control | ✅ Sophisticated with FLY_LEVEL | ❌ Simple cruiseAltitude |
| Repair integration | ✅ Mentioned/planned | ❌ None |
| Elytra unequip | ✅ After landing | ❌ None |

#### Recommendation
**Keep concrete** - More complete and battle-tested. Delete composite.

#### Status
- [ ] Verify concrete has all needed exports
- [ ] Update any imports pointing to composite
- [ ] Delete `composite/ElytraTask.ts`
- [ ] Update `composite/index.ts`

---

### 3. Dragon Fight Tasks

| File | Source |
|------|--------|
| `concrete/DragonFightTask.ts` | BaritonePlus |
| `composite/DragonFightTask.ts` | AltoClef |

#### Comparison

| Aspect | concrete/ (3 classes) | composite/ (1 class) |
|--------|----------------------|---------------------|
| Lines | 912 | 429 |
| Strategies | ✅ Melee, Pearl, Beds (3) | ❌ Single unified |
| Bed bombing | ✅ Full timing logic | ❌ Stub ("simplified") |
| Breath dodging | ❌ None | ✅ `isInBreathCloud` + escape |
| Pearl strategy | ✅ Pillaring + triangulation | ❌ None |
| Modular | ✅ `IDragonWaiter` interface | ❌ Monolithic |

#### Recommendation
**Keep concrete** - More strategies and complete implementations. Merge breath dodging from composite, then delete composite.

#### Status
- [ ] Add breath dodging logic to concrete
- [ ] Update any imports pointing to composite
- [ ] Delete `composite/DragonFightTask.ts`
- [ ] Update `composite/index.ts`

---

### 4. Portal Tasks

| File | Source |
|------|--------|
| `concrete/PortalTask.ts` | BaritonePlus |
| `composite/PortalTask.ts` | AltoClef |

#### Comparison

| Aspect | concrete/EnterNetherPortalTask | composite/PortalTask |
|--------|-------------------------------|---------------------|
| Portal types | Nether only | ✅ Nether + End |
| Building | ❌ Disabled | ✅ Frame + lighting |
| Coord conversion | ❌ None | ✅ `overworldToNether` utils |
| Portal search | ✅ Shell expansion, checks standable | ❌ Simple grid scan |

#### Recommendation
**Keep composite** - More features (building, End portal, coordinate utils). Merge better portal search algorithm from concrete, then delete concrete.

#### Status
- [ ] Port shell-expansion portal search from concrete to composite
- [ ] Port standable-position check from concrete
- [ ] Update any imports pointing to concrete
- [ ] Delete `concrete/PortalTask.ts`
- [ ] Update `concrete/index.ts`

---

### 5. Stronghold Tasks

| File | Source |
|------|--------|
| `concrete/StrongholdTask.ts` | BaritonePlus |
| `composite/StrongholdTask.ts` | AltoClef |

#### Comparison

| Aspect | concrete/ (2 classes + EyeDirection) | composite/ (1 class) |
|--------|-------------------------------------|---------------------|
| Eye tracking | ✅ Tracks actual eye entity | ❌ Uses player yaw |
| Triangulation | ✅ With midpoint fallback | ❌ Returns null on parallel |
| Re-throw logic | ✅ When close to estimate | ❌ None |
| Structure search | ✅ `SearchChunkForBlockTask` | ❌ Simple block scan |

#### Recommendation
**Keep concrete** - Proper eye entity tracking is critical for triangulation accuracy. Delete composite.

#### Status
- [ ] Verify concrete has all needed exports
- [ ] Update any imports pointing to composite
- [ ] Delete `composite/StrongholdTask.ts`
- [ ] Update `composite/index.ts`

---

## Summary Table

| Duplicate | Keep | Delete | Merge Notes |
|-----------|------|--------|-------------|
| Shearing | Merge both | Both after merge | Metadata from concrete + timeouts from composite |
| Elytra | **Concrete** | Composite | - |
| Dragon | **Concrete** | Composite | Add breath dodging from composite |
| Portal | **Composite** | Concrete | Add portal search from concrete |
| Stronghold | **Concrete** | Composite | - |

---

## Implementation Order

Suggested order (least to most complex):

1. **Elytra** - Simple deletion of composite
2. **Stronghold** - Simple deletion of composite
3. **Dragon** - Delete composite after porting breath dodge
4. **Portal** - Delete concrete after porting search algorithm
5. **Shearing** - Full merge required

---

## Notes

- After each deletion, run tests to verify nothing breaks
- Update `index.ts` files in both `concrete/` and `composite/` folders
- Check for any other files that import the deleted tasks

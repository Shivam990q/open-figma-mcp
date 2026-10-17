# 🤝 MULTIPLAYER CRDT VS OPERATIONAL TRANSFORMATION & SCENEGRAPH IMMUTABILITY
## Mathematical Deep Dive into Figma's Distributed Tree Reconciliation, Fractional Indexing, and Consensus

> **Protocol Execution:** *Shivam SEED Protocol — Maximum Cognitive Depth, Ground-Truth Evidence, Algorithmic Rigor, and Zero-Compromise Engineering.*

---

### Executive Overview

Figma's primary technical claim to fame in 2016 was **real-time multiplayer collaboration inside a 60fps WebGL canvas**. Many assume Figma uses a Conflict-free Replicated Data Type (CRDT) like Automerge or Yjs. In reality, Evan Wallace and the early Figma engineering team rejected pure CRDTs in favor of a specialized **centralized, server-reconciled Operational Transformation (OT) variant with immutable scenegraph properties**.

In this investigation, we analyze:
1. Why pure CRDTs fail for 2D visual hierarchy scenegraphs.
2. Figma's server-authoritative tree reconciliation algorithm.
3. Fractional indexing (**LexoRank**) for $O(1)$ sibling insertion without index shifting.
4. How OpenFigma leverages this consensus model for deterministic AI agent mutations.

---

### 1. The Scenegraph Conflict Problem: Why Tree CRDTs are Hard

Collaborative text editing is fundamentally 1-dimensional (an ordered sequence of characters). Trees, however, have two dimensions of failure:
1. **Cycle Creation (The Reparenting Paradox):**
   - User A moves Frame 1 inside Frame 2.
   - User B simultaneously moves Frame 2 inside Frame 1.
   - A naive CRDT creates a cycle (`Frame 1 <-> Frame 2`), detaching both from the root document and bricking the document tree.
2. **Sibling Ordering Clashes:**
   - In design, z-index / layer ordering is critical (which button sits on top of which card).
   - Re-indexing siblings via integer arrays (`[0, 1, 2]`) requires massive $O(N)$ rewriting on every drag-and-drop.

---

### 2. Figma's Server-Authoritative Reconciliation Algorithm

Figma solves the cycle problem by utilizing a **centralized stateful server** running in C++ / Rust:
1. **Immutable Property Deltas:**
   - Changes are not operations like `insert_at(index)`; they are property assignments on a globally unique ID (GUID):
     $$\text{NodeChange} = \{ \text{guid}: G, \text{field}: F, \text{value}: V, \text{ackID}: A \}$$
2. **Server-Sequenced Clock:**
   - The central server assigns a monotonically increasing sequence number to each incoming packet.
   - If User A's reparenting arrives at Sequence 100, and User B's cycle-inducing reparenting arrives at Sequence 101, the server detects the cycle and **rejects** User B's change, broadcasting an undo delta back to User B.
3. **Local Optimistic Execution:**
   - The client immediately applies the change locally (60fps feel).
   - When the server broadcasts the authoritative sequence, the client rolls back unconfirmed optimistic changes, applies the server delta, and replays its local queue.

---

### 3. Fractional Indexing (LexoRank) for Sibling Layer Ordering

To order layers within a frame without storing a continuous array of child IDs, Figma utilizes **Fractional Indexing** (also known as LexoRank):

Each child node stores its position relative to its parent as an arbitrary-precision string:
```typescript
interface ParentIndex {
  guid: GUID; // Parent Frame GUID
  position: string; // e.g., "a0", "a0V", "a1"
}
```

#### Sibling Ordering Algorithm:
To insert a new node $C$ between node $A$ (`"a0"`) and node $B$ (`"a1"`):
1. The client performs a string midpoint interpolation between `"a0"` and `"a1"`:
   $$\text{position}(C) = \text{midpoint}("a0", "a1") = "a0V"$$
2. Since `"a0" < "a0V" < "a1"` in lexicographical ASCII comparison, sorting siblings by `position` string produces the exact visual stacking order in $O(N \log N)$ time with **zero modifications to node $A$ or node $B$**.

---

### 4. Why This Architecture Makes AI Canvas Mutations Bulletproof

When an AI agent (Cursor, Claude Code, Lovable) invokes OpenFigma's `canvas_create_frame` or `canvas_insert_code` tools:
* OpenFigma does not need to lock the canvas or acquire mutexes.
* It generates unique GUIDs and computes appropriate fractional position strings.
* The mutations flow through the companion plugin bridge directly into Figma's local engine, where Figma's reconciliation engine automatically integrates the AI's generated layers seamlessly into the live multiplayer session.

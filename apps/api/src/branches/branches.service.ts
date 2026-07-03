import { Injectable, NotFoundException } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import type { Branch } from "@ultranet/shared-types";

const COLLECTION = "n_branches";

@Injectable()
export class BranchesService {
  constructor(private readonly firebase: FirebaseService) {}

  async findAll(): Promise<Branch[]> {
    const snap = await this.firebase.firestore.collection(COLLECTION).get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch,
    );
  }

  async findOne(id: string): Promise<Branch> {
    const doc = await this.firebase.firestore.collection(COLLECTION).doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Branch ${id} not found`);
    }
    return { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;
  }

  async create(data: Omit<Branch, "id">): Promise<Branch> {
    const ref = await this.firebase.firestore.collection(COLLECTION).add(data);
    return { id: ref.id, ...data };
  }

  async update(id: string, data: Partial<Omit<Branch, "id">>): Promise<Branch> {
    await this.firebase.firestore.collection(COLLECTION).doc(id).set(data, { merge: true });
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.firebase.firestore.collection(COLLECTION).doc(id).delete();
    return { id };
  }
}

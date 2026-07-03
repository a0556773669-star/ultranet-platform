import { Injectable } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import type { Branch } from "@ultranet/shared-types";

@Injectable()
  export class BranchesService {
    constructor(private readonly firebase: FirebaseService) {}

  async findAll(): Promise<Branch[]> {
        const snap = await this.firebase.firestore.collection("n_branches").get();
        return snap.docs.map(
                (d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch,
              );
  }
}

import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { FirebaseModule } from "./firebase/firebase.module";
import { BranchesModule } from "./branches/branches.module";

@Module({
    imports: [FirebaseModule, BranchesModule],
    controllers: [AppController],
})
  export class AppModule {}

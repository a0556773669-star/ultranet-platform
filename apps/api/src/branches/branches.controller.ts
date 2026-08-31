import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import type { Branch } from "@ultranet/shared-types";

@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  findAll() {
    return this.branches.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.branches.findOne(id);
  }

  @Post()
  create(@Body() body: Omit<Branch, "id">) {
    return this.branches.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<Omit<Branch, "id">>) {
    return this.branches.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.branches.remove(id);
  }
}

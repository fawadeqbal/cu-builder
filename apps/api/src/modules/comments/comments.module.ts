import { Module } from "@nestjs/common";
import { CommentsController } from "./comments.controller.js";
import { CommentsService } from "./comments.service.js";

/** Review comments on CVs (experts and career-office reviewers), guarded by `reviewAccess`. */
@Module({ controllers: [CommentsController], providers: [CommentsService], exports: [CommentsService] })
export class CommentsModule {}

import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { createProject } from "../../controllers/v1/project.controller.js";
const v1ProjectRouter = Router();

v1ProjectRouter.use(requireAuth);

v1ProjectRouter.post("/", createProject);

//GET ALL PROJECTS FOR A USER
v1ProjectRouter.get("/", requireAuth, async (req, res) => {
    
});

//GET A PROJECT BY ID
v1ProjectRouter.get("/:id", requireAuth, async (req, res) => {

})

//UPDATE A PROJECT
v1ProjectRouter.put("/:id", requireAuth, async (req, res) => {

})

//DELETE A PROJECT
v1ProjectRouter.delete("/:id", requireAuth, async (req, res) => {
    
})

export default v1ProjectRouter;
import {Router} from "express";
export const notebookRouter=Router();
notebookRouter.post("/submit",(req,res)=>res.json({ok:true,submission_id:`nb_${Date.now()}`,submission:req.body}));
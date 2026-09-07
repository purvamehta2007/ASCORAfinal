import {Router} from "express";
import {chat} from "../services/aiProvider.js";
export const aiChatRouter=Router();
aiChatRouter.post("/chat",async(req,res)=>{
  const {message,context={}}=req.body||{};
  if(!message)return res.status(400).json({error:"message is required"});
  res.json({reply:await chat({message,context})});
});
import { Router } from "express";
import { registerUser, loginUser, forgotPasswordController, resetPasswordController, getProfile, updateProfile, changePassword, refreshTokenController } from "../controllers/userController.js";
import { isAuth } from "../middlewares/auth.js";   

const userRoutes = Router();

userRoutes.post("/auth/register", registerUser);
userRoutes.post("/auth/login", loginUser);
userRoutes.post("/auth/forgot-password", forgotPasswordController);
userRoutes.post("/auth/reset-password", resetPasswordController);
userRoutes.post("/auth/refresh-token", refreshTokenController);


userRoutes.get("/", isAuth, getProfile);               
userRoutes.put("/change-password", isAuth, changePassword); 
userRoutes.put("/", isAuth, updateProfile);            

export default userRoutes;
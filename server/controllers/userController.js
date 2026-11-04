import userModel from "../models/userModel.js";

export const getUserData = async (req,res)=>{
    try {
        const {userId} = req.body
        const user = await userModel.findById(userId);

        if(!user){
            res.json({sucess:false, message: 'User not found'})
        }

        res.json({
            success:true,
            userData: {
                name: user.name,
                email: user.email,
                birthdate: user.birthdate,  
                isAccountVerified : user.isAccountVerified,
                gender: user.gender,
                avatar: user.avatar || '',
            }
        });

    } catch (error) {
        res.json({success: false, message: error.message});
    }
}

export const updateUserGoals = async (req, res) => {
    try {
        const { userId, sleepGoalBedtime, sleepGoalDuration } = req.body;
        
        if (!userId) {
            return res.json({ success: false, message: 'User ID is required' });
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { sleepGoalBedtime, sleepGoalDuration },
            { new: true }
        );

        if (!updatedUser) {
            return res.json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Sleep goals updated successfully',
            goals: {
                sleepGoalBedtime: updatedUser.sleepGoalBedtime,
                sleepGoalDuration: updatedUser.sleepGoalDuration
            }
        });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const updateAvatar = async (req, res) => {
    try {
        const { userId, avatar } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        if (!avatar) {
            return res.status(400).json({ success: false, message: 'Avatar image data is required' });
        }

        const user = await userModel.findByIdAndUpdate(
            userId,
            { avatar },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
            success: true,
            message: 'Profile photo updated successfully',
            avatar: user.avatar
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
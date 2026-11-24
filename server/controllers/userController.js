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
                age: user.age || '',
                avatar: user.avatar || '',
            }
        });

    } catch (error) {
        res.json({success: false, message: error.message});
    }
}

export const updateAvatar = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { avatar } = req.body;

        if (!userId || !avatar) {
            return res.json({ success: false, message: 'User ID and avatar are required' });
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { avatar },
            { new: true }
        );

        if (!updatedUser) {
            return res.json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Avatar updated successfully',
            avatar: updatedUser.avatar,
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { name, age, gender } = req.body;

        if (!userId) {
            return res.json({ success: false, message: 'User ID is required' });
        }

        const updateData = {};
        if (name !== undefined && name.trim()) updateData.name = name.trim();
        if (age !== undefined) updateData.age = String(age);
        if (gender !== undefined) updateData.gender = gender;

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        );

        if (!updatedUser) {
            return res.json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            userData: {
                name: updatedUser.name,
                age: updatedUser.age,
                gender: updatedUser.gender,
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

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
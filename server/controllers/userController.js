import userModel from "../models/userModel.js";

export const getUserData = async (req,res)=>{
    try {
        const {userId} = req.body
        const user = await userModel.findById(userId);

        if(!user){
            res.json({sucess:false, message: 'User not found'})
        }

        const calculatedAge = user.age || (user.birthdate ? Math.floor((new Date() - new Date(user.birthdate)) / 31557600000) : '');

        res.json({
            success:true,
            userData: {
                name: user.name,
                email: user.email,
                birthdate: user.birthdate,  
                isAccountVerified : user.isAccountVerified,
                gender: user.gender || 'Prefer not to say',
                age: calculatedAge ? String(calculatedAge) : '',
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

export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.body.userId || req.user?.id;
        const { name, email, age, gender } = req.body;

        if (!userId) {
            return res.json({ success: false, message: 'User ID is required' });
        }

        const updateFields = {};
        if (name !== undefined) updateFields.name = name;
        if (email !== undefined) updateFields.email = email;
        if (age !== undefined && age !== '') updateFields.age = Number(age);
        if (gender !== undefined) updateFields.gender = gender;

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updateFields,
            { new: true }
        );

        if (!updatedUser) {
            return res.json({ success: false, message: 'User not found' });
        }

        const calculatedAge = updatedUser.age || (updatedUser.birthdate ? Math.floor((new Date() - new Date(updatedUser.birthdate)) / 31557600000) : '');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            userData: {
                name: updatedUser.name,
                email: updatedUser.email,
                birthdate: updatedUser.birthdate,
                isAccountVerified: updatedUser.isAccountVerified,
                gender: updatedUser.gender || 'Prefer not to say',
                age: calculatedAge ? String(calculatedAge) : '',
                avatar: updatedUser.avatar || '',
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
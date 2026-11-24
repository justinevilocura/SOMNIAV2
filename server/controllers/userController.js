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

export const changePassword = async (req, res) => {
    try {
        const userId = req.body.userId;
        const { currentPassword, newPassword } = req.body;

        if (!userId || !currentPassword || !newPassword) {
            return res.json({ success: false, message: 'All fields are required' });
        }

        if (newPassword.length < 6) {
            return res.json({ success: false, message: 'New password must be at least 6 characters' });
        }

        const bcrypt = (await import('bcryptjs')).default;
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await userModel.findByIdAndUpdate(userId, { password: hashedPassword });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const userId = req.body.userId;

        if (!userId) {
            return res.json({ success: false, message: 'User ID is required' });
        }

        // Delete the user and all their associated data
        const user = await userModel.findByIdAndDelete(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Clean up all related data collections
        try {
            const SleepSession = (await import('../models/sleepSessionModel.js')).default;
            const HeartRate = (await import('../models/heartRateModel.js')).default;
            const Steps = (await import('../models/stepsModel.js')).default;
            const Exercise = (await import('../models/exerciseModel.js')).default;
            await Promise.all([
                SleepSession.deleteMany({ user: userId }),
                HeartRate.deleteMany({ userId }),
                Steps.deleteMany({ userId }),
                Exercise.deleteMany({ userId }),
            ]);
        } catch (cleanupErr) {
            console.warn('Partial cleanup error:', cleanupErr.message);
        }

        res.json({ success: true, message: 'Account and all data deleted successfully' });
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
import userModel from "../models/userModel.js";

export const getUserData = async (req,res)=>{
    try {
        const {userId} = req.body
        const user = await userModel.findById(userId);

        if(!user){
            res.json({sucess:false, message: 'User not found'})
        }

        // Compute age if explicit age is set, or derive from birthdate
        let calculatedAge = user.age || 0;
        if (!calculatedAge && user.birthdate) {
            const birth = new Date(user.birthdate);
            if (!isNaN(birth.getTime())) {
                const today = new Date();
                let a = today.getFullYear() - birth.getFullYear();
                const mDiff = today.getMonth() - birth.getMonth();
                if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
                    a--;
                }
                calculatedAge = Math.max(0, a);
            }
        }

        res.json({
            success:true,
            userData: {
                name: user.name,
                email: user.email,
                birthdate: user.birthdate,  
                age: calculatedAge,
                isAccountVerified : user.isAccountVerified,
                gender: user.gender,
                avatar: user.avatar || '',
                sleepGoalBedtime: user.sleepGoalBedtime || '22:30',
                sleepGoalDuration: user.sleepGoalDuration || 8,
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

export const updateProfile = async (req, res) => {
    try {
        const { userId, name, age, birthdate, gender } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const updates = {};
        if (name && typeof name === 'string' && name.trim()) {
            updates.name = name.trim();
        }

        if (age !== undefined && age !== null && age !== '') {
            const parsedAge = parseInt(age, 10);
            if (!isNaN(parsedAge) && parsedAge >= 0 && parsedAge <= 130) {
                updates.age = parsedAge;
                // Keep birthdate approximate if not set
                const approxBirth = new Date();
                approxBirth.setFullYear(approxBirth.getFullYear() - parsedAge);
                updates.birthdate = approxBirth;
            } else {
                return res.status(400).json({ success: false, message: 'Please enter a valid age (0-130)' });
            }
        } else if (birthdate) {
            const parsedDate = new Date(birthdate);
            if (!isNaN(parsedDate.getTime())) {
                updates.birthdate = parsedDate;
                const today = new Date();
                let a = today.getFullYear() - parsedDate.getFullYear();
                const mDiff = today.getMonth() - parsedDate.getMonth();
                if (mDiff < 0 || (mDiff === 0 && today.getDate() < parsedDate.getDate())) {
                    a--;
                }
                updates.age = Math.max(0, a);
            }
        }

        if (gender) {
            const allowedGenders = ['Male', 'Female', 'Prefer not to say'];
            if (!allowedGenders.includes(gender)) {
                return res.status(400).json({ success: false, message: 'Invalid gender value' });
            }
            updates.gender = gender;
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updates,
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            userData: {
                name: updatedUser.name,
                email: updatedUser.email,
                birthdate: updatedUser.birthdate,
                age: updatedUser.age,
                gender: updatedUser.gender,
                avatar: updatedUser.avatar || '',
                isAccountVerified: updatedUser.isAccountVerified,
                sleepGoalBedtime: updatedUser.sleepGoalBedtime,
                sleepGoalDuration: updatedUser.sleepGoalDuration
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
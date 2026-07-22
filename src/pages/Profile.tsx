import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  calculateTargets,
  ACTIVITY_LABELS,
  GOAL_LABELS,
} from '@/lib/nutrition';
import {
  saveGuestProfile,
  addGuestWeight,
  getGuestWeightLogs,
  deleteGuestWeight as deleteGuestWeightFn,
} from '@/lib/guestStorage';
import type { WeightLog, BiologicalSex, ActivityLevel, TargetGoal } from '@/types';
import { formatDate } from '@/lib/dateUtils';
import { Save, Loader2, Check, Plus, Trash2, User, Scale } from 'lucide-react';

export function Profile() {
  const { user, profile, refreshProfile, isGuest, updateGuestProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [weight, setWeight] = useState(profile?.current_weight_kg?.toString() || '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() || '');
  const [sex, setSex] = useState<BiologicalSex>(profile?.biological_sex || 'male');
  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level || 'moderately_active');
  const [goal, setGoal] = useState<TargetGoal>(profile?.target_goal || 'maintain');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [newWeight, setNewWeight] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setWeight(profile.current_weight_kg?.toString() || '');
      setHeight(profile.height_cm?.toString() || '');
      setSex(profile.biological_sex || 'male');
      setAge(profile.age?.toString() || '');
      setActivity(profile.activity_level || 'moderately_active');
      setGoal(profile.target_goal || 'maintain');
    }
  }, [profile]);

  const loadWeightLogs = async () => {
    if (isGuest) {
      setWeightLogs(getGuestWeightLogs());
      return;
    }
    if (!user) return;
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(30);
    if (data) setWeightLogs(data as WeightLog[]);
  };

  useEffect(() => {
    loadWeightLogs();
  }, [user, isGuest]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const ageNum = parseInt(age, 10) || profile?.age || 25;
      const heightNum = parseFloat(height) || profile?.height_cm || 170;
      const weightNum = parseFloat(weight) || profile?.current_weight_kg || 70;
      const targets = calculateTargets(weightNum, heightNum, ageNum, sex, activity, goal);

      if (isGuest) {
        updateGuestProfile({
          display_name: displayName,
          avatar_url: avatarUrl,
          current_weight_kg: weightNum,
          height_cm: heightNum,
          biological_sex: sex,
          age: ageNum,
          activity_level: activity,
          target_goal: goal,
          target_daily_calories: targets.targetCalories,
          target_protein_g: targets.protein,
          target_carbs_g: targets.carbs,
          target_fat_g: targets.fat,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          current_weight_kg: weightNum,
          height_cm: heightNum,
          biological_sex: sex,
          age: ageNum,
          activity_level: activity,
          target_goal: goal,
          target_daily_calories: targets.targetCalories,
          target_protein_g: targets.protein,
          target_carbs_g: targets.carbs,
          target_fat_g: targets.fat,
        })
        .eq('id', user!.id);

      if (error) throw error;
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Profile save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const logWeight = async () => {
    const w = parseFloat(newWeight);
    if (!w) return;

    if (isGuest) {
      addGuestWeight(w);
      saveGuestProfile({ current_weight_kg: w });
      updateGuestProfile({ current_weight_kg: w });
      setNewWeight('');
      loadWeightLogs();
      return;
    }

    const { error } = await supabase.from('weight_logs').insert({
      weight_kg: w,
      logged_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Weight log failed:', error.message);
      return;
    }
    await supabase.from('profiles').update({ current_weight_kg: w }).eq('id', user!.id);
    await refreshProfile();
    setNewWeight('');
    loadWeightLogs();
  };

  const deleteWeightLog = async (id: string) => {
    if (isGuest) {
      deleteGuestWeightFn(id);
      setWeightLogs((prev) => prev.filter((w) => w.id !== id));
      return;
    }
    const { error } = await supabase.from('weight_logs').delete().eq('id', id);
    if (error) return;
    setWeightLogs((prev) => prev.filter((w) => w.id !== id));
  };

  const ACTIVITIES = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][];
  const GOALS = Object.entries(GOAL_LABELS) as [TargetGoal, string][];

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Profile</h1>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-5">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <User size={28} className="text-primary-600 dark:text-primary-400" />
            </div>
          )}
          <div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {isGuest ? 'Guest mode' : (profile?.email || user?.email)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Profile Picture URL</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Body Metrics
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Height (cm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Biological Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as BiologicalSex)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Activity Level</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {ACTIVITIES.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {GOALS.map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setGoal(val)}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
                    goal === val
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary-500 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors disabled:opacity-50 mb-6"
      >
        {saving ? (
          <><Loader2 size={18} className="animate-spin" /> Saving…</>
        ) : saved ? (
          <><Check size={18} /> Saved!</>
        ) : (
          <><Save size={18} /> Save Profile</>
        )}
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Scale size={18} className="text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Weight History
          </h2>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="number"
            step="0.1"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Log new weight (kg)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            onKeyDown={(e) => e.key === 'Enter' && logWeight()}
          />
          <button
            onClick={logWeight}
            className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {weightLogs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No weight logs yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {weightLogs.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 group">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{w.weight_kg} kg</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(w.logged_at)}</span>
                </div>
                <button
                  onClick={() => deleteWeightLog(w.id)}
                  className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

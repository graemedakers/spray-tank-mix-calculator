import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, Platform, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { calculate, type Ingredient, type VolumeUnit, type AreaUnit, type RateUnit, type CalculatorResult } from './lib/calculator';

// ─── Ad Unit IDs ─────────────────────────────────────────────
// Replace TEST IDs with your real AdMob unit IDs before production build
const BANNER_AD_ID = __DEV__
  ? TestIds.BANNER
  : Platform.OS === 'ios'
    ? 'ca-app-pub-8488326065495220/1898383138'   // iOS banner unit
    : 'ca-app-pub-8488326065495220/2962993301';  // Android banner unit

// ─── Types ───────────────────────────────────────────────────
type Tab = 'calc' | 'settings' | 'help';

const RATE_UNITS: RateUnit[] = [
  'oz/acre', 'lb/acre', 'ml/acre', 'kg/acre',
  'oz/hectare', 'lb/hectare', 'ml/hectare', 'kg/hectare',
];

let _id = 1;
function uid() { return `i-${_id++}`; }
function makeIng(): Ingredient { return { id: uid(), name: '', rate: 0, rateUnit: 'oz/acre' }; }

const PREFS_KEY = 'stmc-prefs-v1';

// ─── Component ────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState<Tab>('calc');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('gallons');
  const [areaUnit, setAreaUnit]     = useState<AreaUnit>('acres');
  const [tankVol, setTankVol]       = useState('');
  const [area, setArea]             = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([makeIng()]);
  const [result, setResult]           = useState<CalculatorResult | null>(null);
  const [rateUnitPickerIdx, setRateUnitPickerIdx] = useState<string | null>(null); // id of ingredient whose picker is open

  // Load persisted prefs
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(raw => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        if (p.volumeUnit) setVolumeUnit(p.volumeUnit);
        if (p.areaUnit) setAreaUnit(p.areaUnit);
      } catch {}
    });
  }, []);

  // Save prefs on change
  useEffect(() => {
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ volumeUnit, areaUnit }));
  }, [volumeUnit, areaUnit]);

  // Auto-recalculate
  useEffect(() => {
    const tv = parseFloat(tankVol);
    const ar = parseFloat(area);
    if (isNaN(tv) || tv <= 0 || isNaN(ar) || ar <= 0) { setResult(null); return; }
    setResult(calculate({ tankVolume: tv, volumeUnit, areaSprayed: ar, areaUnit, ingredients }));
  }, [tankVol, area, volumeUnit, areaUnit, ingredients]);

  const updateIng = useCallback((id: string, field: keyof Ingredient, value: any) => {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }, []);

  const addIng    = () => setIngredients(prev => [...prev, makeIng()]);
  const removeIng = (id: string) => setIngredients(prev => prev.filter(i => i.id !== id));

  const vLabel = volumeUnit === 'gallons' ? 'gal' : 'L';
  const aLabel = areaUnit === 'acres' ? 'ac' : 'ha';

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🌿 Spray Tank Calculator</Text>
        <Text style={s.headerSub}>Agricultural mixing tool</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {(['calc', 'settings', 'help'] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'calc' ? 'Calculator' : t === 'settings' ? 'Settings' : 'Help'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* ── CALCULATOR TAB ── */}
        {tab === 'calc' && (
          <>
            {/* Tank Setup */}
            <View style={s.card}>
              <Text style={s.cardTitle}><Text style={s.num}>① </Text>Tank Setup</Text>
              <Text style={s.label}>Tank Volume</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" placeholder="e.g. 100" placeholderTextColor="#52525b"
                value={tankVol} onChangeText={setTankVol} />
              <Text style={s.label}>Volume Unit</Text>
              <View style={s.pillRow}>
                {(['gallons', 'liters'] as VolumeUnit[]).map(u => (
                  <TouchableOpacity key={u} onPress={() => setVolumeUnit(u)} style={[s.pill, volumeUnit === u && s.pillActive]}>
                    <Text style={[s.pillText, volumeUnit === u && s.pillTextActive]}>{u === 'gallons' ? 'Gallons' : 'Liters'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Area */}
            <View style={s.card}>
              <Text style={s.cardTitle}><Text style={s.num}>② </Text>Area to Spray</Text>
              <Text style={s.label}>Area</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" placeholder="e.g. 50" placeholderTextColor="#52525b"
                value={area} onChangeText={setArea} />
              <Text style={s.label}>Area Unit</Text>
              <View style={s.pillRow}>
                {(['acres', 'hectares'] as AreaUnit[]).map(u => (
                  <TouchableOpacity key={u} onPress={() => setAreaUnit(u)} style={[s.pill, areaUnit === u && s.pillActive]}>
                    <Text style={[s.pillText, areaUnit === u && s.pillTextActive]}>{u === 'acres' ? 'Acres' : 'Hectares'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Ingredients */}
            <View style={s.card}>
              <Text style={s.cardTitle}><Text style={s.num}>③ </Text>Products</Text>
              {ingredients.map((ing, idx) => (
                <View key={ing.id} style={s.ingCard}>
                  <View style={s.ingHeader}>
                    <Text style={s.ingIdx}>Product {idx + 1}</Text>
                    {ingredients.length > 1 && (
                      <TouchableOpacity onPress={() => removeIng(ing.id)}>
                        <Text style={s.removeBtn}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={s.label}>Product Name</Text>
                  <TextInput style={s.input} placeholder="e.g. Glyphosate" placeholderTextColor="#52525b"
                    value={ing.name} onChangeText={v => updateIng(ing.id, 'name', v)} />
                  <View style={[s.pillRow, { marginTop: 12 }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={s.label}>Rate</Text>
                      <TextInput style={s.input} keyboardType="decimal-pad" placeholder="e.g. 32" placeholderTextColor="#52525b"
                        value={ing.rate ? String(ing.rate) : ''} onChangeText={v => updateIng(ing.id, 'rate', parseFloat(v) || 0)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Unit</Text>
                      <TouchableOpacity style={[s.input, s.pickerTrigger]} onPress={() => setRateUnitPickerIdx(rateUnitPickerIdx === ing.id ? null : ing.id)}>
                        <Text style={{ color: '#e4e4e7', fontSize: 15 }}>{ing.rateUnit}</Text>
                        <Text style={{ color: '#71717a', fontSize: 12 }}>▾</Text>
                      </TouchableOpacity>
                      {rateUnitPickerIdx === ing.id && (
                        <View style={s.pickerDropdown}>
                          {RATE_UNITS.map(u => (
                            <TouchableOpacity key={u} onPress={() => { updateIng(ing.id, 'rateUnit', u); setRateUnitPickerIdx(null); }}
                              style={[s.pickerOption, u === ing.rateUnit && s.pickerOptionActive]}>
                              <Text style={[s.pickerOptionText, u === ing.rateUnit && s.pickerOptionTextActive]}>{u}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.addBtn} onPress={addIng}>
                <Text style={s.addBtnText}>+ Add Another Product</Text>
              </TouchableOpacity>
            </View>

            {/* Results */}
            {result && (
              <View style={[s.card, result.isValid ? s.resultCardOk : s.resultCardErr]}>
                <Text style={[s.cardTitle, { color: result.isValid ? '#4ade80' : '#f87171' }]}>
                  ④ {result.isValid ? 'Mix Results ✓' : 'Error'}
                </Text>
                {result.error && <Text style={s.errorText}>{result.error}</Text>}
                {result.ingredientAmounts.map(r => (
                  <View key={r.id} style={s.resultRow}>
                    <Text style={s.resultLabel}>{r.name || 'Product'}</Text>
                    <Text style={s.resultValue}>{r.amount.toLocaleString()} <Text style={s.resultUnit}>{r.displayUnit}</Text></Text>
                  </View>
                ))}
                <View style={s.divider} />
                <View style={s.resultRow}>
                  <Text style={[s.resultLabel, { color: '#60a5fa' }]}>💧 Water Required</Text>
                  <Text style={[s.resultValue, { color: '#93c5fd', fontSize: 20 }]}>{result.waterVolume.toLocaleString()} <Text style={s.resultUnit}>{vLabel}</Text></Text>
                </View>
                <View style={s.resultRow}>
                  <Text style={[s.resultLabel, { color: '#71717a', fontSize: 12 }]}>Total Tank Fill</Text>
                  <Text style={[s.resultValue, { color: '#a1a1aa', fontSize: 14 }]}>{result.totalVolume} {vLabel}</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Default Units</Text>
            <Text style={s.label}>Volume Unit</Text>
            <View style={s.pillRow}>
              {(['gallons', 'liters'] as VolumeUnit[]).map(u => (
                <TouchableOpacity key={u} onPress={() => setVolumeUnit(u)} style={[s.pill, volumeUnit === u && s.pillActive]}>
                  <Text style={[s.pillText, volumeUnit === u && s.pillTextActive]}>{u === 'gallons' ? 'Gallons' : 'Liters'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { marginTop: 16 }]}>Area Unit</Text>
            <View style={s.pillRow}>
              {(['acres', 'hectares'] as AreaUnit[]).map(u => (
                <TouchableOpacity key={u} onPress={() => setAreaUnit(u)} style={[s.pill, areaUnit === u && s.pillActive]}>
                  <Text style={[s.pillText, areaUnit === u && s.pillTextActive]}>{u === 'acres' ? 'Acres' : 'Hectares'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.label, { marginTop: 20, fontSize: 11 }]}>Preferences are saved automatically between sessions.</Text>
          </View>
        )}

        {/* ── HELP TAB ── */}
        {tab === 'help' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>How to Use</Text>
            {[
              ['① Tank Volume', 'Enter your total spray tank capacity.'],
              ['② Area', 'Enter the total area you plan to spray.'],
              ['③ Products', 'Add each chemical with its label rate and unit.'],
              ['④ Results', 'The calculator instantly shows product amounts and water volume.'],
            ].map(([t, d]) => (
              <View key={t} style={s.helpRow}>
                <Text style={s.helpTitle}>{t}</Text>
                <Text style={s.helpDesc}>{d}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* AdMob Banner — fixed bottom safe zone */}
      <View style={s.adBanner}>
        <BannerAd
          unitId={BANNER_AD_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#09090b' },
  header:         { backgroundColor: '#18181b', borderBottomWidth: 1, borderBottomColor: '#27272a', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 48 : 20, paddingBottom: 16 },
  headerTitle:    { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  headerSub:      { color: '#71717a', fontSize: 12, marginTop: 2 },
  tabBar:         { flexDirection: 'row', backgroundColor: '#18181b', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tabBtn:         { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: '#22c55e' },
  tabText:        { color: '#71717a', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive:  { color: '#fff' },
  scroll:         { flex: 1 },
  scrollContent:  { padding: 16, paddingBottom: 80 },
  card:           { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 16, padding: 20, marginBottom: 14 },
  cardTitle:      { color: '#e4e4e7', fontWeight: '700', fontSize: 14, marginBottom: 14 },
  num:            { color: '#22c55e' },
  label:          { color: '#71717a', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input:          { backgroundColor: '#09090b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10, color: '#fff', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 4 },
  pillRow:        { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pill:           { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: '#3f3f46' },
  pillActive:     { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)' },
  pillText:       { color: '#71717a', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#4ade80' },
  ingCard:        { backgroundColor: 'rgba(9,9,11,0.5)', borderWidth: 1, borderColor: '#27272a', borderRadius: 12, padding: 14, marginBottom: 12 },
  ingHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ingIdx:         { color: '#71717a', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  removeBtn:      { color: 'rgba(239,68,68,0.6)', fontSize: 13, fontWeight: '600' },
  addBtn:         { borderWidth: 1, borderStyle: 'dashed', borderColor: '#3f3f46', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addBtnText:     { color: '#71717a', fontWeight: '600', fontSize: 14 },
  pickerTrigger:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerDropdown: { position: 'absolute', top: 90, left: 0, right: 0, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10, zIndex: 100 },
  pickerOption:   { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  pickerOptionActive: { backgroundColor: 'rgba(34,197,94,0.1)' },
  pickerOptionText: { color: '#a1a1aa', fontSize: 14 },
  pickerOptionTextActive: { color: '#4ade80', fontWeight: '700' },
  resultCardOk:   { borderColor: 'rgba(34,197,94,0.2)', backgroundColor: 'rgba(34,197,94,0.04)' },
  resultCardErr:  { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.04)' },
  resultRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(63,63,70,0.4)' },
  resultLabel:    { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
  resultValue:    { color: '#fff', fontSize: 17, fontWeight: '800' },
  resultUnit:     { color: '#71717a', fontSize: 13, fontWeight: '400' },
  divider:        { height: 1, backgroundColor: '#27272a', marginVertical: 8 },
  errorText:      { color: '#f87171', fontSize: 13, marginBottom: 12 },
  helpRow:        { borderLeftWidth: 2, borderLeftColor: 'rgba(34,197,94,0.4)', paddingLeft: 14, marginBottom: 16 },
  helpTitle:      { color: '#e4e4e7', fontWeight: '700', fontSize: 14 },
  helpDesc:       { color: '#71717a', fontSize: 13, marginTop: 2 },
  adBanner:       { minHeight: 50, backgroundColor: '#18181b', borderTopWidth: 1, borderTopColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  adText:         { color: '#3f3f46', fontSize: 11 },
});

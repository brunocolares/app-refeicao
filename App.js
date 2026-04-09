import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  SectionList, ScrollView, KeyboardAvoidingView, Platform,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  redDark:    '#BF3B44',
  redMid:     '#F3BABD',
  redLight:   '#F4E6E7',
  greenDark:  '#639339',
  greenMid:   '#CBE4B4',
  greenLight: '#E5F0DB',
  gray1: '#1B1D1E',
  gray2: '#333638',
  gray3: '#5C6265',
  gray4: '#B9BBBC',
  gray5: '#DDDEDF',
  gray6: '#EFF0F0',
  gray7: '#FAFAFA',
  white: '#FFFFFF',
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayDate() {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2,'0'),
    String(d.getMonth()+1).padStart(2,'0'),
    String(d.getFullYear()).slice(-2),
  ].join('.');
}

function nowTime() {
  const d = new Date();
  return [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':');
}

function dateMs(date, time) {
  const [dd,mm,yy] = date.split('.');
  const [hh,mn] = time.split(':');
  return new Date(`20${yy}-${mm}-${dd}T${hh}:${mn}:00`).getTime();
}

function groupByDate(meals) {
  const map = {};
  const sorted = [...meals].sort((a,b) => dateMs(b.date,b.time) - dateMs(a.date,a.time));
  for (const m of sorted) {
    if (!map[m.date]) map[m.date] = [];
    map[m.date].push(m);
  }
  return Object.entries(map).map(([title, data]) => ({ title, data }));
}

function calcStats(meals) {
  const total = meals.length;
  if (!total) return { total:0, onDiet:0, offDiet:0, percent:0, bestSeq:0 };
  const onDiet = meals.filter(m => m.isOnDiet).length;
  const percent = Math.round((onDiet / total) * 10000) / 100;
  const sorted = [...meals].sort((a,b) => dateMs(a.date,a.time) - dateMs(b.date,b.time));
  let best=0, cur=0;
  for (const m of sorted) { if (m.isOnDiet) { cur++; if (cur>best) best=cur; } else cur=0; }
  return { total, onDiet, offDiet: total-onDiet, percent, bestSeq: best };
}

const STORAGE_KEY = '@dailydiet:meals';

async function storagGetAll() {
  try { const d = await AsyncStorage.getItem(STORAGE_KEY); return d ? JSON.parse(d) : []; }
  catch { return []; }
}
async function storagSave(meals) { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals)); }
async function storagAdd(meal)    { const all = await storagGetAll(); await storagSave([...all, meal]); }
async function storagUpdate(meal) { const all = await storagGetAll(); await storagSave(all.map(m => m.id===meal.id ? meal : m)); }
async function storagDelete(id)   { const all = await storagGetAll(); await storagSave(all.filter(m => m.id!==id)); }

const MealsCtx = createContext({});

function MealsProvider({ children }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setMeals(await storagGetAll());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, []);

  const addMeal = useCallback(async (m) => {
    await storagAdd(m);
    setMeals(p => [...p, m]);
  }, []);

  const updateMeal = useCallback(async (m) => {
    await storagUpdate(m);
    setMeals(p => p.map(x => x.id===m.id ? m : x));
  }, []);

  const deleteMeal = useCallback(async (id) => {
    await storagDelete(id);
    setMeals(p => p.filter(x => x.id!==id));
  }, []);

  const findMeal = useCallback((id) => meals.find(m => m.id===id), [meals]);

  return (
    <MealsCtx.Provider value={{ meals, loading, reload, addMeal, updateMeal, deleteMeal, findMeal }}>
      {children}
    </MealsCtx.Provider>
  );
}

function useMeals() { return useContext(MealsCtx); }

function Button({ title, variant='primary', loading, iconLeft, style, ...rest }) {
  const primary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[bs.btn, primary ? bs.primary : bs.secondary, style]}
      activeOpacity={0.75}
      {...rest}
    >
      {loading
        ? <ActivityIndicator color={primary ? C.white : C.gray1} />
        : <>
            {iconLeft && <Text style={[bs.icon, primary ? bs.iconPrimary : bs.iconDark]}>{iconLeft}</Text>}
            <Text style={[bs.label, primary ? bs.labelPrimary : bs.labelSecondary]}>{title}</Text>
          </>}
    </TouchableOpacity>
  );
}
const bs = StyleSheet.create({
  btn:          { flexDirection:'row', alignItems:'center', justifyContent:'center', height:50, borderRadius:6, paddingHorizontal:24, gap:8 },
  primary:      { backgroundColor: C.gray2 },
  secondary:    { backgroundColor:'transparent', borderWidth:1.5, borderColor: C.gray2 },
  label:        { fontSize:14, fontWeight:'700' },
  labelPrimary: { color: C.white },
  labelSecondary:{ color: C.gray1 },
  icon:         { fontSize:16 },
  iconPrimary:  { color: C.white },
  iconDark:     { color: C.gray1 },
});

function Input({ label, error, style, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ins.wrap}>
      <Text style={ins.label}>{label}</Text>
      <TextInput
        style={[ins.input, focused && ins.focused, !!error && ins.errBorder, style]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={C.gray4}
        {...rest}
      />
      {!!error && <Text style={ins.errTxt}>{error}</Text>}
    </View>
  );
}
const ins = StyleSheet.create({
  wrap:      { gap:4 },
  label:     { fontSize:14, fontWeight:'700', color: C.gray2 },
  input:     { borderWidth:1, borderColor: C.gray4, borderRadius:6, padding:14, fontSize:16, color: C.gray1, backgroundColor: C.white },
  focused:   { borderColor: C.gray2 },
  errBorder: { borderColor: C.redDark },
  errTxt:    { fontSize:12, color: C.redDark },
});

// DietToggle
function DietToggle({ value, onChange, error }) {
  return (
    <View style={dt.wrap}>
      <Text style={dt.label}>Está dentro da dieta?</Text>
      <View style={dt.row}>
        {[true, false].map(opt => {
          const isYes = opt === true;
          const sel   = value === opt;
          return (
            <TouchableOpacity
              key={String(opt)}
              style={[dt.opt, sel && (isYes ? dt.selY : dt.selN)]}
              onPress={() => onChange(opt)}
              activeOpacity={0.7}
            >
              <View style={[dt.dot, { backgroundColor: isYes ? C.greenDark : C.redDark }]} />
              <Text style={[dt.optTxt, sel && dt.optTxtSel]}>{isYes ? 'Sim' : 'Não'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!!error && <Text style={dt.errTxt}>{error}</Text>}
    </View>
  );
}
const dt = StyleSheet.create({
  wrap:      { gap:4 },
  label:     { fontSize:14, fontWeight:'700', color: C.gray2 },
  row:       { flexDirection:'row', gap:8 },
  opt:       { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, height:50, borderRadius:6, borderWidth:1.5, borderColor:'transparent', backgroundColor: C.gray6 },
  selY:      { backgroundColor: C.greenLight, borderColor: C.greenDark },
  selN:      { backgroundColor: C.redLight,   borderColor: C.redDark },
  dot:       { width:8, height:8, borderRadius:4 },
  optTxt:    { fontSize:14, fontWeight:'700', color: C.gray2 },
  optTxtSel: { color: C.gray1 },
  errTxt:    { fontSize:12, color: C.redDark },
});

// MealCard
function MealCard({ meal, onPress }) {
  return (
    <TouchableOpacity style={mc.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={mc.time}>{meal.time}</Text>
      <View style={mc.div} />
      <Text style={mc.name} numberOfLines={1}>{meal.name}</Text>
      <View style={[mc.dot, meal.isOnDiet ? mc.dotG : mc.dotR]} />
    </TouchableOpacity>
  );
}
const mc = StyleSheet.create({
  card: { flexDirection:'row', alignItems:'center', borderWidth:1, borderColor: C.gray5, borderRadius:6, padding:14, backgroundColor: C.white, gap:12 },
  time: { fontSize:12, fontWeight:'700', color: C.gray1 },
  div:  { width:1, height:14, backgroundColor: C.gray4 },
  name: { flex:1, fontSize:16, color: C.gray2 },
  dot:  { width:14, height:14, borderRadius:7 },
  dotG: { backgroundColor: C.greenMid },
  dotR: { backgroundColor: C.redMid },
});

// StatCard
function StatCard({ value, label, variant='default', large=false }) {
  const bg = { default: C.gray6, green: C.greenLight, red: C.redLight }[variant];
  return (
    <View style={[sc.card, { backgroundColor: bg }, large && sc.large]}>
      <Text style={[sc.val, large && sc.valLg]}>{value}</Text>
      <Text style={sc.lbl}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:  { flex:1, alignItems:'center', justifyContent:'center', borderRadius:8, padding:16, gap:4 },
  large: { paddingVertical:20 },
  val:   { fontSize:24, fontWeight:'700', color: C.gray1 },
  valLg: { fontSize:32 },
  lbl:   { fontSize:12, color: C.gray2, textAlign:'center' },
});

// BackHeader
function BackHeader({ title, accent }) {
  const nav = useNavigation();
  return (
    <View style={bh.row}>
      <TouchableOpacity onPress={() => nav.goBack()} style={bh.btn} activeOpacity={0.7}>
        <Text style={[bh.arrow, { color: accent ?? C.gray1 }]}>←</Text>
      </TouchableOpacity>
      <Text style={bh.title}>{title}</Text>
      <View style={bh.btn} />
    </View>
  );
}
const bh = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingVertical:16 },
  btn:   { width:32, height:32, justifyContent:'center' },
  arrow: { fontSize:24, fontWeight:'700' },
  title: { flex:1, textAlign:'center', fontSize:18, fontWeight:'700', color: C.gray1 },
});

function HomeScreen() {
  const nav = useNavigation();
  const { meals, reload } = useMeals();

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const st  = calcStats(meals);
  const good = st.percent >= 50;
  const cardBg = good ? C.greenLight : C.redLight;
  const accent  = good ? C.greenDark  : C.redDark;

  return (
    <SafeAreaView style={hs.safe} edges={['top']}>
      <View style={hs.top}>
        {/* Logo */}
        <View style={hs.logoRow}>
          <View style={hs.dot1} /><View style={hs.dot2} />
          <Text style={hs.logoTxt}>App</Text>
          <Text style={hs.logoBold}>Dieta</Text>
        </View>

        {/* Stats card */}
        <TouchableOpacity style={[hs.statsCard, { backgroundColor: cardBg }]} onPress={() => nav.navigate('Statistics')} activeOpacity={0.85}>
          <Text style={[hs.statsPct, { color: accent }]}>{st.percent.toFixed(2).replace('.',',')}%</Text>
          <Text style={hs.statsLbl}>das refeições dentro da dieta</Text>
          <Text style={[hs.statsArrow, { color: accent }]}>↗</Text>
        </TouchableOpacity>
      </View>

      <View style={hs.body}>
        <Text style={hs.secTitle}>Refeições</Text>
        <Button title="Nova refeição" iconLeft="+" onPress={() => nav.navigate('NewMeal')} style={hs.newBtn} />

        {meals.length === 0
          ? <View style={hs.empty}>
              <Text style={hs.emptyIcon}>🥗</Text>
              <Text style={hs.emptyTitle}>Nenhuma refeição cadastrada</Text>
              <Text style={hs.emptySub}>Toque em "Nova refeição" para começar!</Text>
            </View>
          : <SectionList
              sections={groupByDate(meals)}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom:32 }}
              renderSectionHeader={({ section }) => <Text style={hs.dateHdr}>{section.title}</Text>}
              renderItem={({ item }) => (
                <MealCard meal={item} onPress={() => nav.navigate('MealDetails', { mealId: item.id })} />
              )}
              ItemSeparatorComponent={() => <View style={{ height:8 }} />}
              SectionSeparatorComponent={() => <View style={{ height:4 }} />}
            />}
      </View>
    </SafeAreaView>
  );
}
const hs = StyleSheet.create({
  safe:       { flex:1, backgroundColor: C.gray7 },
  top:        { paddingHorizontal:24, paddingTop:16 },
  logoRow:    { flexDirection:'row', alignItems:'center', marginBottom:24, gap:4 },
  dot1:       { width:36, height:36, borderRadius:18, backgroundColor: C.gray1 },
  dot2:       { width:22, height:22, borderRadius:11, backgroundColor: C.greenDark, marginLeft:-10 },
  logoTxt:    { marginLeft:8, fontSize:20, color: C.gray1 },
  logoBold:   { fontSize:20, fontWeight:'700', color: C.gray1 },
  statsCard:  { borderRadius:8, padding:20, alignItems:'center', position:'relative', marginBottom:4 },
  statsPct:   { fontSize:32, fontWeight:'700' },
  statsLbl:   { fontSize:14, color: C.gray2, marginTop:4 },
  statsArrow: { position:'absolute', top:10, right:14, fontSize:20, fontWeight:'700' },
  body:       { flex:1, paddingHorizontal:24, paddingTop:36 },
  secTitle:   { fontSize:16, color: C.gray1, marginBottom:8 },
  newBtn:     { marginBottom:28 },
  dateHdr:    { fontSize:18, fontWeight:'700', color: C.gray1, marginBottom:8, marginTop:8 },
  empty:      { alignItems:'center', paddingTop:60, gap:10 },
  emptyIcon:  { fontSize:56 },
  emptyTitle: { fontSize:16, fontWeight:'700', color: C.gray3 },
  emptySub:   { fontSize:14, color: C.gray4, textAlign:'center' },
});

// STATISTICS
function StatisticsScreen() {
  const nav = useNavigation();
  const { meals } = useMeals();
  const st = calcStats(meals);
  const good   = st.percent >= 50;
  const accent = good ? C.greenDark  : C.redDark;
  const bg     = good ? C.greenLight : C.redLight;

  return (
    <SafeAreaView style={[ss.safe, { backgroundColor: bg }]} edges={['top']}>
      <View style={ss.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={ss.backBtn} activeOpacity={0.7}>
          <Text style={[ss.arrow, { color: accent }]}>←</Text>
        </TouchableOpacity>
        <View style={ss.hCenter}>
          <Text style={[ss.pct, { color: accent }]}>{st.percent.toFixed(2).replace('.',',')}%</Text>
          <Text style={ss.pctLbl}>das refeições dentro da dieta</Text>
        </View>
        <View style={ss.backBtn} />
      </View>

      <ScrollView style={ss.body} contentContainerStyle={ss.bodyContent} showsVerticalScrollIndicator={false}>
        <Text style={ss.secTitle}>Estatísticas gerais</Text>
        <StatCard value={st.bestSeq} label="melhor sequência de refeições dentro da dieta" large />
        <StatCard value={st.total}   label="refeições registradas" large />
        <View style={ss.row}>
          <StatCard value={st.onDiet}  label="refeições dentro da dieta" variant="green" />
          <StatCard value={st.offDiet} label="refeições fora da dieta"   variant="red" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const ss = StyleSheet.create({
  safe:        { flex:1 },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingVertical:16 },
  backBtn:     { width:32, height:32, justifyContent:'center' },
  arrow:       { fontSize:24, fontWeight:'700' },
  hCenter:     { flex:1, alignItems:'center' },
  pct:         { fontSize:32, fontWeight:'700' },
  pctLbl:      { fontSize:14, color: C.gray2, textAlign:'center', marginTop:4 },
  body:        { flex:1, backgroundColor: C.gray7, borderTopLeftRadius:20, borderTopRightRadius:20 },
  bodyContent: { padding:24, gap:12 },
  secTitle:    { fontSize:12, fontWeight:'700', color: C.gray2, textAlign:'center', marginBottom:8 },
  row:         { flexDirection:'row', gap:12 },
});

// MEAL FORM (create + edit)
function MealFormScreen({ mode }) {
  const nav   = useNavigation();
  const route = useRoute();
  const { addMeal, updateMeal, findMeal } = useMeals();

  const [name,   setName]   = useState('');
  const [desc,   setDesc]   = useState('');
  const [date,   setDate]   = useState(todayDate());
  const [time,   setTime]   = useState(nowTime());
  const [onDiet, setOnDiet] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy,   setBusy]   = useState(false);

  useEffect(() => {
    if (mode === 'edit' && route.params?.mealId) {
      const m = findMeal(route.params.mealId);
      if (m) { setName(m.name); setDesc(m.description); setDate(m.date); setTime(m.time); setOnDiet(m.isOnDiet); }
    }
  }, []);

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Nome obrigatório';
    if (!date.trim() || !/^\d{2}\.\d{2}\.\d{2}$/.test(date)) e.date = 'Formato: DD.MM.AA';
    if (!time.trim() || !/^\d{2}:\d{2}$/.test(time))         e.time = 'Formato: HH:MM';
    if (onDiet === null) e.onDiet = 'Selecione uma opção';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'create') {
        const m = { id: genId(), name: name.trim(), description: desc.trim(), date, time, isOnDiet: onDiet, createdAt: Date.now() };
        await addMeal(m);
        nav.replace('MealFeedback', { isOnDiet: onDiet });
      } else {
        const ex = findMeal(route.params.mealId);
        await updateMeal({ ...ex, name: name.trim(), description: desc.trim(), date, time, isOnDiet: onDiet });
        nav.navigate('MealDetails', { mealId: ex.id });
      }
    } catch { Alert.alert('Erro', 'Não foi possível salvar.'); }
    finally  { setBusy(false); }
  }

  return (
    <SafeAreaView style={mf.safe} edges={['top']}>
      <BackHeader title={mode === 'create' ? 'Nova refeição' : 'Editar refeição'} />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={mf.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Input label="Nome" value={name} onChangeText={setName} placeholder="Nome da refeição" error={errors.name} />
          <Input label="Descrição" value={desc} onChangeText={setDesc} placeholder="Descrição" multiline numberOfLines={5} style={mf.textarea} textAlignVertical="top" />
          <View style={mf.row}>
            <View style={{ flex:1 }}>
              <Input label="Data" value={date} onChangeText={setDate} placeholder="12.08.25" keyboardType="numeric" maxLength={8} error={errors.date} />
            </View>
            <View style={{ flex:1 }}>
              <Input label="Hora" value={time} onChangeText={setTime} placeholder="12:30" keyboardType="numeric" maxLength={5} error={errors.time} />
            </View>
          </View>
          <DietToggle value={onDiet} onChange={setOnDiet} error={errors.onDiet} />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={mf.footer}>
        <Button title={mode === 'create' ? 'Cadastrar refeição' : 'Salvar alterações'} onPress={submit} loading={busy} />
      </View>
    </SafeAreaView>
  );
}
const mf = StyleSheet.create({
  safe:     { flex:1, backgroundColor: C.gray7 },
  scroll:   { padding:24, gap:24 },
  row:      { flexDirection:'row', gap:20 },
  textarea: { height:120, paddingTop:14 },
  footer:   { padding:24 },
});

// MEAL DETAILS
function MealDetailsScreen() {
  const nav   = useNavigation();
  const route = useRoute();
  const { findMeal, deleteMeal } = useMeals();
  const [confirm, setConfirm] = useState(false);

  const meal = findMeal(route.params.mealId);
  if (!meal) return (
    <SafeAreaView style={{ flex:1, backgroundColor: C.gray7 }} edges={['top']}>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:16, padding:24 }}>
        <Text style={{ color: C.gray3, fontSize:16 }}>Refeição não encontrada.</Text>
        <Button title="Voltar" onPress={() => nav.goBack()} />
      </View>
    </SafeAreaView>
  );

  const good   = meal.isOnDiet;
  const accent = good ? C.greenDark  : C.redDark;
  const bg     = good ? C.greenLight : C.redLight;

  async function handleDelete() {
    await deleteMeal(meal.id);
    setConfirm(false);
    nav.navigate('Home');
  }

  return (
    <SafeAreaView style={[md.safe, { backgroundColor: bg }]} edges={['top']}>
      {/* Header */}
      <View style={md.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={md.backBtn} activeOpacity={0.7}>
          <Text style={[md.arrow, { color: accent }]}>←</Text>
        </TouchableOpacity>
        <Text style={[md.hTitle, { color: accent }]}>Refeição</Text>
        <View style={md.backBtn} />
      </View>

      {/* Body */}
      <ScrollView style={md.body} contentContainerStyle={md.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={md.block}>
          <Text style={md.mName}>{meal.name}</Text>
          <Text style={md.mDesc}>{meal.description || 'Sem descrição.'}</Text>
        </View>
        <View style={md.block}>
          <Text style={md.infoLbl}>Data e hora</Text>
          <Text style={md.infoVal}>{meal.date} às {meal.time}</Text>
        </View>
        <View style={md.badge}>
          <View style={[md.badgeDot, { backgroundColor: good ? C.greenDark : C.redDark }]} />
          <Text style={md.badgeTxt}>{good ? 'dentro da dieta' : 'fora da dieta'}</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={md.footer}>
        <Button title="Editar refeição"  iconLeft="✎"  onPress={() => nav.navigate('EditMeal', { mealId: meal.id })} />
        <Button title="Excluir refeição" iconLeft="🗑" variant="secondary" onPress={() => setConfirm(true)} />
      </View>

      {/* Delete modal */}
      <Modal visible={confirm} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.modal}>
            <Text style={md.mTitle}>Excluir refeição</Text>
            <Text style={md.mText}>Deseja realmente excluir o registro da refeição?</Text>
            <View style={md.mBtns}>
              <Button title="Cancelar"    variant="secondary" style={md.mBtn} onPress={() => setConfirm(false)} />
              <Button title="Sim, excluir"                    style={md.mBtn} onPress={handleDelete} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const md = StyleSheet.create({
  safe:        { flex:1 },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:24, paddingVertical:16 },
  backBtn:     { width:32, height:32, justifyContent:'center' },
  arrow:       { fontSize:24, fontWeight:'700' },
  hTitle:      { flex:1, textAlign:'center', fontSize:18, fontWeight:'700' },
  body:        { flex:1, backgroundColor: C.white, borderTopLeftRadius:20, borderTopRightRadius:20 },
  bodyContent: { padding:24, gap:24 },
  block:       { gap:8 },
  mName:       { fontSize:24, fontWeight:'700', color: C.gray1 },
  mDesc:       { fontSize:16, color: C.gray2, lineHeight:22 },
  infoLbl:     { fontSize:14, fontWeight:'700', color: C.gray1 },
  infoVal:     { fontSize:16, color: C.gray2 },
  badge:       { flexDirection:'row', alignItems:'center', alignSelf:'flex-start', gap:8, backgroundColor: C.gray6, borderRadius:100, paddingHorizontal:16, paddingVertical:8 },
  badgeDot:    { width:8, height:8, borderRadius:4 },
  badgeTxt:    { fontSize:14, color: C.gray1 },
  footer:      { backgroundColor: C.white, padding:24, gap:12 },
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', padding:24 },
  modal:       { backgroundColor: C.white, borderRadius:8, padding:40, alignItems:'center', gap:8, width:'100%' },
  mTitle:      { fontSize:18, fontWeight:'700', color: C.gray1, textAlign:'center' },
  mText:       { fontSize:16, color: C.gray2, textAlign:'center', marginBottom:8 },
  mBtns:       { flexDirection:'row', gap:12, width:'100%' },
  mBtn:        { flex:1 },
});

// MEAL FEEDBACK
function MealFeedbackScreen() {
  const nav   = useNavigation();
  const route = useRoute();
  const good  = route.params.isOnDiet;

  return (
    <SafeAreaView style={fb.safe} edges={['top','bottom']}>
      <View style={fb.wrap}>
        <View style={[fb.circle, good ? fb.circleG : fb.circleR]}>
          <Text style={fb.emoji}>{good ? '🥗' : '😔'}</Text>
        </View>
        <View style={fb.txtBlock}>
          <Text style={[fb.headline, { color: good ? C.greenDark : C.redDark }]}>
            {good ? 'Continue assim!' : 'Que pena!'}
          </Text>
          <Text style={fb.body}>
            {good
              ? <Text>Você continua <Text style={fb.bold}>dentro da dieta</Text>. Muito bem!</Text>
              : <Text>Você saiu da dieta dessa vez, mas continue se esforçando e <Text style={fb.bold}>não desista</Text>!</Text>}
          </Text>
        </View>
        <Button title="Ir para a página inicial" onPress={() => nav.navigate('Home')} style={fb.btn} />
      </View>
    </SafeAreaView>
  );
}
const fb = StyleSheet.create({
  safe:     { flex:1, backgroundColor: C.gray7 },
  wrap:     { flex:1, alignItems:'center', justifyContent:'center', padding:32, gap:32 },
  circle:   { width:200, height:200, borderRadius:100, alignItems:'center', justifyContent:'center', borderWidth:3 },
  circleG:  { backgroundColor: C.greenLight, borderColor: C.greenMid },
  circleR:  { backgroundColor: C.redLight,   borderColor: C.redMid },
  emoji:    { fontSize:80 },
  txtBlock: { alignItems:'center', gap:16 },
  headline: { fontSize:32, fontWeight:'700', textAlign:'center' },
  body:     { fontSize:16, color: C.gray2, textAlign:'center', lineHeight:24 },
  bold:     { fontWeight:'700', color: C.gray1 },
  btn:      { width:'100%' },
});

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <MealsProvider>
        <StatusBar style="dark" />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home"         component={HomeScreen} />
            <Stack.Screen name="Statistics"   component={StatisticsScreen} />
            <Stack.Screen name="NewMeal">
              {() => <MealFormScreen mode="create" />}
            </Stack.Screen>
            <Stack.Screen name="EditMeal">
              {() => <MealFormScreen mode="edit" />}
            </Stack.Screen>
            <Stack.Screen name="MealDetails"  component={MealDetailsScreen} />
            <Stack.Screen name="MealFeedback" component={MealFeedbackScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </MealsProvider>
    </SafeAreaProvider>
  );
}
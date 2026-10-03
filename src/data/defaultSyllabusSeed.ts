import { MasterSubject } from '../types/syllabus';

export const DEFAULT_HSC_SYLLABUS: MasterSubject[] = [
  {
    id: 'physics-1',
    name: 'Physics 1st Paper',
    code: 'PHY-174',
    color: '#003820',
    order: 1,
    chapters: [
      {
        id: 'phy-ch2',
        name: 'Chapter 2: Vectors',
        order: 1,
        topics: [
          {
            id: 'phy-top-1',
            title: 'Vector Addition & Triangle Law',
            subconcept: 'Resultant magnitude & angle calculation using analytical laws',
            durationMinutes: 45,
            tag: 'Core Mechanics',
            totalWeight: 2,
          },
          {
            id: 'phy-top-2',
            title: 'Dot & Cross Product Mechanics',
            subconcept: 'Scalar and vector product properties with angle between vectors',
            durationMinutes: 50,
            tag: 'Calculus Applied',
            totalWeight: 2,
          },
          {
            id: 'phy-top-3',
            title: 'River-Boat Problems & Relative Velocity',
            subconcept: 'Shortest path vs shortest time navigation dynamics',
            durationMinutes: 60,
            tag: 'Advanced Problem',
            totalWeight: 2,
          },
        ],
      },
      {
        id: 'phy-ch4',
        name: 'Chapter 4: Newtonian Mechanics',
        order: 2,
        topics: [
          {
            id: 'phy-top-4',
            title: 'Momentum Conservation & Rocket Motion',
            subconcept: 'Variable mass propulsion and impulse of force',
            durationMinutes: 45,
            tag: 'Dynamic Laws',
            totalWeight: 2,
          },
          {
            id: 'phy-top-5',
            title: 'Circular Motion & Road Banking',
            subconcept: 'Centripetal acceleration and angle of banking derivations',
            durationMinutes: 55,
            tag: 'High Yield',
            totalWeight: 2,
          },
        ],
      },
      {
        id: 'phy-ch5',
        name: 'Chapter 5: Work, Energy & Power',
        order: 3,
        topics: [
          {
            id: 'phy-top-6',
            title: 'Work-Energy Theorem & Spring Potential',
            subconcept: 'Conservative vs non-conservative forces in vertical loops',
            durationMinutes: 40,
            tag: 'Energy Laws',
            totalWeight: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'chemistry-1',
    name: 'Chemistry 1st Paper',
    code: 'CHE-176',
    color: '#006c49',
    order: 2,
    chapters: [
      {
        id: 'che-ch2',
        name: 'Chapter 2: Qualitative Chemistry',
        order: 1,
        topics: [
          {
            id: 'che-top-1',
            title: 'Quantum Numbers & Electron Configurations',
            subconcept: 'Aufbau, Hund, Pauli Exclusion principles & exceptions',
            durationMinutes: 45,
            tag: 'Atomic Structure',
            totalWeight: 2,
          },
          {
            id: 'che-top-2',
            title: 'Solubility Product (Ksp & Kip)',
            subconcept: 'Precipitation criteria, common ion effect in analytical testing',
            durationMinutes: 50,
            tag: 'Equilibrium',
            totalWeight: 2,
          },
        ],
      },
      {
        id: 'che-ch3',
        name: 'Chapter 3: Periodic Properties & Chemical Bonds',
        order: 2,
        topics: [
          {
            id: 'che-top-3',
            title: 'Hybridization & VSEPR Molecular Geometry',
            subconcept: 'sp, sp2, sp3 shapes, bond angles, dipole moments',
            durationMinutes: 55,
            tag: 'Molecular Bond',
            totalWeight: 2,
          },
          {
            id: 'che-top-4',
            title: 'Fajans Rules & Covalent Character',
            subconcept: 'Polarization of anions, melting point & lattice energy trends',
            durationMinutes: 40,
            tag: 'Periodic Trends',
            totalWeight: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'math-1',
    name: 'Higher Mathematics 1st Paper',
    code: 'MTH-265',
    color: '#0b1c30',
    order: 3,
    chapters: [
      {
        id: 'mth-ch1',
        name: 'Chapter 1: Matrices & Determinants',
        order: 1,
        topics: [
          {
            id: 'mth-top-1',
            title: 'Matrix Multiplication & Inverses',
            subconcept: 'Cofactor expansion, Adjoint matrices, Cramers rule',
            durationMinutes: 45,
            tag: 'Linear Algebra',
            totalWeight: 2,
          },
        ],
      },
      {
        id: 'mth-ch3',
        name: 'Chapter 3: Straight Lines',
        order: 2,
        topics: [
          {
            id: 'mth-top-2',
            title: 'Perpendicular Distance & Angle Between Lines',
            subconcept: 'Distance from point to line, bisectors of angles',
            durationMinutes: 50,
            tag: 'Coordinate Geometry',
            totalWeight: 2,
          },
        ],
      },
      {
        id: 'mth-ch9',
        name: 'Chapter 9: Differentiation',
        order: 3,
        topics: [
          {
            id: 'mth-top-3',
            title: 'First Principles & Chain Rule Calculus',
            subconcept: 'Derivative of trigonometric, exponential, and implicit functions',
            durationMinutes: 60,
            tag: 'Core Calculus',
            totalWeight: 2,
          },
          {
            id: 'mth-top-4',
            title: 'Maxima & Minima Optimization',
            subconcept: 'Second derivative test for turning points and inflection',
            durationMinutes: 55,
            tag: 'Calculus App',
            totalWeight: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'biology-1',
    name: 'Biology 1st Paper (Botany)',
    code: 'BIO-178',
    color: '#1b4d3e',
    order: 4,
    chapters: [
      {
        id: 'bio-ch1',
        name: 'Chapter 1: Cell & its Structure',
        order: 1,
        topics: [
          {
            id: 'bio-top-1',
            title: 'Fluid Mosaic Model & Organelle Function',
            subconcept: 'Plasma membrane structure, mitochondria, ribosomes',
            durationMinutes: 40,
            tag: 'Cell Biology',
            totalWeight: 2,
          },
          {
            id: 'bio-top-2',
            title: 'DNA Double Helix & Semi-Conservative Replication',
            subconcept: 'Watson-Crick model, helicase, DNA polymerase mechanics',
            durationMinutes: 50,
            tag: 'Molecular Genetics',
            totalWeight: 2,
          },
        ],
      },
      {
        id: 'bio-ch9',
        name: 'Chapter 9: Plant Physiology',
        order: 2,
        topics: [
          {
            id: 'bio-top-3',
            title: 'Photosynthesis: Light Dependent & Calvin Cycle',
            subconcept: 'Photosystem I & II, Z-scheme photophosphorylation, C3 vs C4',
            durationMinutes: 55,
            tag: 'Metabolism',
            totalWeight: 2,
          },
        ],
      },
    ],
  },
];

import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const ROSE_GOLD = '#C4956A';
const OFF_WHITE = '#F5F0EB';

const AnimatedLine: React.FC<{delay: number}> = ({delay}) => {
	const frame = useCurrentFrame();
	const progress = interpolate(frame, [delay, delay + 45], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return (
		<div
			style={{
				width: progress * 180,
				height: 1,
				backgroundColor: ROSE_GOLD,
			}}
		/>
	);
};

const AnimatedWord: React.FC<{
	text: string;
	delay: number;
	fontSize: number;
	fontWeight: number;
	letterSpacing: number;
	color: string;
}> = ({text, delay, fontSize, fontWeight, letterSpacing, color}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const progress = spring({
		frame: frame - delay,
		fps,
		config: {damping: 20, stiffness: 80, mass: 0.8},
	});

	const opacity = interpolate(frame, [delay, delay + 25], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const translateY = interpolate(progress, [0, 1], [30, 0]);

	return (
		<div
			style={{
				fontSize,
				fontWeight,
				letterSpacing,
				color,
				fontFamily: 'Georgia, serif',
				opacity,
				transform: `translateY(${translateY}px)`,
			}}
		>
			{text}
		</div>
	);
};

export const LogoScene: React.FC = () => {
	const frame = useCurrentFrame();

	const bgOpacity = interpolate(frame, [0, 25], [0, 1], {
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				background: 'linear-gradient(160deg, #0D0D0D 0%, #1A1210 100%)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				opacity: bgOpacity,
			}}
		>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 24,
				}}
			>
				<AnimatedLine delay={10} />
				<AnimatedWord
					text="BEA'S"
					delay={25}
					fontSize={88}
					fontWeight={700}
					letterSpacing={16}
					color={OFF_WHITE}
				/>
				<AnimatedWord
					text="PROJECT"
					delay={45}
					fontSize={36}
					fontWeight={300}
					letterSpacing={22}
					color={ROSE_GOLD}
				/>
				<AnimatedLine delay={35} />
			</div>
		</AbsoluteFill>
	);
};
